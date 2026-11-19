import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
// Only numeric IDs of our own live child handles. No shell, no kill-by-image-name.
// The caller must await BOTH this request and the child's close (not just exit)
// before unlinking files or releasing the operation lease.
export async function terminateTree(child: ChildProcess) {
  const pid = child.pid;
  if (!pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    const killed = await new Promise<boolean>((resolve) => {
      const tool = spawn(
        path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/PID', String(pid), '/T', '/F'],
        { windowsHide: true, shell: false, stdio: 'ignore' },
      );
      tool.once('error', () => resolve(false));
      tool.once('close', (code) => resolve(code === 0));
    });
    if (killed) return;
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
      return;
    } catch {
      /* Not a process-group leader, or it already exited. */
    }
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}
