import { execSync } from 'child_process';

const port = process.argv[2] || '3000';

function killOnWindows() {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[kill-port] stopped PID ${pid} on port ${port}`);
      } catch {
        // already gone
      }
    }
  } catch {
    // nothing listening
  }
}

function killOnUnix() {
  try {
    const pid = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
    if (pid) {
      execSync(`kill -9 ${pid}`);
      console.log(`[kill-port] stopped PID ${pid} on port ${port}`);
    }
  } catch {
    // nothing listening
  }
}

if (process.platform === 'win32') killOnWindows();
else killOnUnix();
