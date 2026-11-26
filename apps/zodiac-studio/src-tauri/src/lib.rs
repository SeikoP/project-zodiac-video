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

fn retry_safe(method: &str) -> bool {
    matches!(method, "health" | "projects.list" | "projects.open" | "events.list" |
        "events.recent" | "assets.list" | "agent.health" | "agent.task" |
        "agent.tasks" | "voice.audio")
}

#[cfg(test)]
mod audit_tests {
    use super::retry_safe;
    #[test]
    fn only_explicit_reads_can_replay() {
        for method in ["health", "projects.list", "voice.audio"] { assert!(retry_safe(method)); }
        for method in ["projects.command", "voice.start", "agent.apply", "pipeline.run", "visual.command", "future.method"] {
            assert!(!retry_safe(method));
        }
    }
}

struct LivePython {
    process: Child,
    input: Option<ChildStdin>,
    output: BufReader<ChildStdout>,
}

impl Drop for LivePython {
    fn drop(&mut self) {
        // EOF lets Python cancel/reap its managed agent before we force exit.
        self.input.take();
        for _ in 0..150 {
            if matches!(self.process.try_wait(), Ok(Some(_))) {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
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
        let mut command = Command::new(python);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW for managed Python
        }
        let mut process = command
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
            input: Some(input),
            output: BufReader::new(output),
        });
        Ok(())
    }

    fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        const METHODS: &[&str] = &[
            "ideas.list",
            "ideas.update",
            "health",
            "projects.list",
            "projects.open",
            "projects.import",
            "projects.command",
            "events.list",
            "events.recent",
            "assets.list",
            "agent.health",
            "agent.start",
            "agent.task",
            "agent.tasks",
            "agent.cancel",
            "agent.apply",
            "agent.visual.start",
            "agent.author.start",
            "voice.open",
            "voice.start",
            "voice.cancel",
            "voice.select",
            "voice.assemble",
            "voice.audio",
            "voice.playback",
            "voice.confirm",
            "visual.open",
            "visual.command",
            "visual.cancel",
            "visual.preview",
            "episode.build",
            "scene.compile",
            "video.export",
            "video.get",
            "assets.describe",
            "assets.gallery",
            "assets.find_candidates",
            "validation.get",
            "pipeline.get",
            "pipeline.run",
            "pipeline.cancel",
            "pipeline.mode.set",
            "pipeline.evidence",
            "pipeline.autopilot.start",
            "pipeline.autopilot.stop",
            "pipeline.card.resolve",
            "pipeline.gate.playback",
            "pipeline.gate.confirm",
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
        let limit = if method == "visual.command" { 2 * 1024 * 1024 } else { 65_536 };
        if serialized.len() > limit {
            return Err("RPC_REQUEST_TOO_LARGE".into());
        }
        self.counter = self.counter.wrapping_add(1);
        for attempt in 0..2 {
            if self.child.is_none() {
                self.spawn()?;
            }
            let child = self.child.as_mut().expect("spawn succeeded");
            let mut buffer = String::new();
            let input = child.input.as_mut().expect("live stdin");
            let outcome = input
                .write_all(&serialized)
                .and_then(|_| input.write_all(b"\n"))
                .and_then(|_| input.flush())
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
                    // A lost reply can follow a successful write; never replay mutations.
                    if attempt == 1 || !retry_safe(method) {
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

    #[test]
    fn video_method_reaches_python_without_approving_a_project() {
        let temp = std::env::temp_dir().canonicalize().unwrap();
        let root = temp.join(format!("zodiac-export-host-{}", std::process::id()));
        {
            let mut host = Backend::new(root.clone());
            let result = host
                .request("video.get", json!({"project_id":"missing"}))
                .unwrap();
            assert_eq!(result["ok"], false);
            assert_eq!(result["error"]["code"], "PROJECT_NOT_FOUND");
        }
        assert!(root.is_absolute() && root.starts_with(&temp));
        std::fs::remove_dir_all(root).unwrap();
    }
}
