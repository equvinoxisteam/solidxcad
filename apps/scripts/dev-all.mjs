#!/usr/bin/env node
/**
 * Start SolidX CAD API + Web (+ CAD Viewer via API auto-start).
 * Usage: npm run dev   (from apps/)
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appsRoot = path.resolve(__dirname, '..');
const apiDir = path.join(appsRoot, 'solidxcad-api');
const webDir = path.join(appsRoot, 'solidxcad-web');

const children = [];

function run(name, cwd, script) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npm, ['run', script], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      AUTO_START_VIEWER: 'true',
    },
  });
  child.on('error', (err) => {
    console.error(`[dev] ${name} failed:`, err.message);
  });
  children.push({ name, child });
  return child;
}

function shutdown() {
  for (const { name, child } of children) {
    try {
      if (!child.killed) {
        console.log(`[dev] stopping ${name}…`);
        child.kill('SIGTERM');
      }
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('[dev] SolidX CAD — API :4000 + Web :3000');
console.log('[dev] CAD Viewer auto-starts when API boots (port 4178+)');
console.log('[dev] Open http://localhost:3000\n');

run('api', apiDir, 'dev');
setTimeout(() => run('web', webDir, 'dev'), 4000);
