// Launch the pinned Job@5 renderer's real Remotion Studio after actual
// render-plan/payload/spatial checks. No independent HTML mock is used.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareRendererProps} from './prepare.mjs';
import {findPinnedRemotionCli} from './local-remotion-cli.mjs';

export const studioArgs = (entry, props) => ['studio', entry, '--props=' + props];

export const openJob5Studio = async (workspace, launch = spawn) => {
  const root = resolve(workspace);
  const {output} = await prepareRendererProps(root);
  const cli = await findPinnedRemotionCli();
  const args = studioArgs('src/index.ts', output);
  console.log('JOB5_STUDIO_READY renderer=' + cli.version + ' props=' + output);
  return await new Promise((done, fail) => {
    const child = launch(process.execPath, [cli.entry, ...args], {
      cwd: cli.rendererDir,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', fail);
    child.once('exit', (code, signal) => {
      if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') done(code ?? 0);
      else fail(new Error('JOB5_STUDIO_EXIT code=' + code + ' signal=' + signal));
    });
  });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = process.argv[2];
  if (!workspace) {
    console.error('Usage: node scripts/open-studio.mjs <job-workspace>');
    process.exitCode = 2;
  } else {
    try {
      process.exitCode = await openJob5Studio(workspace);
    } catch (error) {
      console.error(JSON.stringify({
        ok: false, stage: 'STUDIO', code: error?.code ?? 'JOB5_STUDIO_LAUNCH_FAILED',
        message: error?.message ?? String(error),
      }));
      process.exitCode = 2;
    }
  }
}
