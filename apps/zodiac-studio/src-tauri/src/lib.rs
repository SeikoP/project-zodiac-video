//! One-window Tauri host. Python P0 Project Core stays authoritative.
//! IPC methods are explicitly whitelisted; no generic shell/filesystem bridge.
use serde_json::{json, Value};
use std::{
    env,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
    sync::{Arc, Mutex},
};
use tauri::Manager;

struct LivePython {
    process: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl Drop for LivePython {
    fn drop(&mut self) {
        let _ = self.process.kill();
        let _ = self.process.wait();
    }
}

struct Backend {
    project_root: PathBuf,
    source_root: Option<PathBuf>,
    child: Option<LivePython>,
    counter: u64,
}

impl Backend {
    fn new(project_root: PathBuf) -> Self {
        // Source-tree development mode; shipping an embedded Python executable
        // requires a separate bundle/release gate, not a hidden production claim.
        let mut candidates = Vec::new();
        if let Some(override_dir) = env::var_os("ZODIAC_STUDIO_SOURCE_ROOT") {
            candidates.push(PathBuf::from(override_dir));
        }
        candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."));
        if let Ok(cwd) = env::current_dir() {
            candidates.push(cwd);
        }
        let source_root = candidates
            .into_iter()
            .filter_map(|path| path.canonicalize().ok())
            .find(|path| path.join("tools/studio_project/rpc_stdio.py").is_file());
        Self {
            project_root,
            source_root,
            child: None,
            counter: 0,
        }
    }

    fn spawn(&mut self) -> Result<(), String> {
        let source_root = self.source_root.as_ref().ok_or(
            "PYTHON_SOURCE_ROOT_MISSING: set ZODIAC_STUDIO_SOURCE_ROOT to the Zodiac repository",
        )?;
        let python = env::var_os("ZODIAC_STUDIO_PYTHON").unwrap_or_else(|| "python".into());
        let mut process = Command::new(python)
            .args([
                "-u",
                "-m",
                "tools.studio_project.rpc_stdio",
                "--projects-root",
            ])
            .arg(&self.project_root)
            .current_dir(source_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null()) // no unbounded pipe / UI deadlock
            .spawn()
            .map_err(|e| format!("PYTHON_START_FAILED: {e}"))?;
        let input = process.stdin.take().ok_or("PYTHON_PIPE_MISSING: stdin")?;
        let output = process.stdout.take().ok_or("PYTHON_PIPE_MISSING: stdout")?;
        self.child = Some(LivePython {
            process,
            input,
            output: BufReader::new(output),
        });
        Ok(())
    }

    fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        const METHODS: &[&str] = &[
            "health",
            "projects.list",
            "projects.open",
            "projects.import",
            "projects.command",
            "events.list",
            "events.recent",
            "assets.list",
        ];
        if !METHODS.contains(&method) {
            return Err("RPC_METHOD_FORBIDDEN".into());
        }
        let serialized = serde_json::to_vec(&json!({
            "id": format!("studio-{}", self.counter),
            "method": method,
            "params": params,
        }))
        .map_err(|e| format!("RPC_SERIALIZE_FAILED: {e}"))?;
        if serialized.len() > 65_536 {
            return Err("RPC_REQUEST_TOO_LARGE".into());
        }
        self.counter = self.counter.wrapping_add(1);
        for attempt in 0..2 {
            if self.child.is_none() {
                self.spawn()?;
            }
            let child = self.child.as_mut().expect("spawn succeeded");
            let mut buffer = String::new();
            let outcome = child
                .input
                .write_all(&serialized)
                .and_then(|_| child.input.write_all(b"\n"))
                .and_then(|_| child.input.flush())
                .and_then(|_| {
                    child
                        .output
                        .read_line(&mut buffer)
                        .map(|n| {
                            if n == 0 {
                                Err(std::io::Error::new(
                                    std::io::ErrorKind::UnexpectedEof,
                                    "Backend closed",
                                ))
                            } else {
                                Ok(())
                            }
                        })
                        .and_then(|x| x)
                });
            match outcome {
                Ok(()) => {
                    let response: Value = serde_json::from_str(&buffer)
                        .map_err(|e| format!("PYTHON_INVALID_RESPONSE: {e}"))?;
                    return Ok(response);
                }
                Err(error) => {
                    self.child = None; // Drop kills/reaps process
                    if attempt == 1 {
                        return Err(format!("PYTHON_TRANSPORT_FAILED: {error}"));
                    }
                }
            }
        }
        Err("PYTHON_TRANSPORT_FAILED".into())
    }
}

#[tauri::command]
async fn studio_request(
    state: tauri::State<'_, Arc<Mutex<Backend>>>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    let backend = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || {
        let mut backend = backend.lock().map_err(|_| "BACKEND_MUTEX_POISONED")?;
        backend.request(&method, params)
    })
    .await
    .map_err(|e| format!("BACKEND_WORKER_FAILED: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let project_root = env::var_os("ZODIAC_STUDIO_PROJECTS")
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    app.path()
                        .app_data_dir()
                        .expect("Cannot resolve application data")
                        .join("projects")
                });
            std::fs::create_dir_all(&project_root)?;
            app.manage(Arc::new(Mutex::new(Backend::new(project_root))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![studio_request])
        .run(tauri::generate_context!())
        .expect("Failed to start Zodiac Studio Tauri host");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn methods_allowlist_rejects_shell() {
        let mut host = Backend::new(std::env::temp_dir().join("zodiac-test"));
        assert_eq!(
            host.request("shell.exec", json!({"command": "whoami"}))
                .unwrap_err(),
            "RPC_METHOD_FORBIDDEN"
        );
    }
}
