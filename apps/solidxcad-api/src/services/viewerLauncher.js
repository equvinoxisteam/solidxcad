import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const HOST = '127.0.0.1';
const PORT_START = Number(process.env.VIEWER_PORT_START || 4178);
const PORT_SCAN = Number(process.env.VIEWER_PORT_SCAN || 16);
const PROBE_MS = 400;
const START_TIMEOUT_MS = 120000;

let cachedBaseUrl = '';
let startingPromise = null;
let childProcess = null;

function isExternalViewerUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname !== '127.0.0.1' && hostname !== 'localhost';
  } catch {
    return false;
  }
}

async function probeViewer(host, port) {
  const baseUrl = `http://${host}:${port}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_MS);
    const res = await fetch(`${baseUrl}/__cad/server`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.app === 'cad-viewer') return baseUrl;
  } catch {
    // not running
  }
  return null;
}

export async function discoverViewerUrl() {
  if (config.viewerUrl) {
    const configured = await probeViewer(HOST, new URL(config.viewerUrl).port || PORT_START);
    if (configured) return configured;
  }

  for (let i = 0; i < PORT_SCAN; i += 1) {
    const port = PORT_START + i;
    const found = await probeViewer(HOST, port);
    if (found) return found;
  }
  return '';
}

function viewerScriptPath() {
  return path.join(config.textToCadRoot, 'viewer', 'scripts', 'start-agent-viewer.mjs');
}

function viewerPackageRoot() {
  return path.join(config.textToCadRoot, 'viewer');
}

function viewerNodeModulesReady() {
  return fs.existsSync(path.join(viewerPackageRoot(), 'node_modules'));
}

async function installViewerDeps() {
  if (viewerNodeModulesReady()) return;
  console.log('[viewer] installing CAD Viewer dependencies (first run only)…');
  await new Promise((resolve, reject) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npm, ['install'], {
      cwd: viewerPackageRoot(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install in viewer/ failed (code ${code})`));
    });
  });
}

function spawnViewer() {
  const script = viewerScriptPath();
  if (!fs.existsSync(script)) {
    throw new Error(`CAD Viewer launcher not found: ${script}`);
  }

  const args = [
    script,
    '--host', HOST,
    '--port', String(PORT_START),
    '--viewer-start-mode=dev',
    '--shutdown-after=12h',
  ];

  const cadpySrc = path.join(config.textToCadRoot, 'packages', 'cadpy', 'src');
  const viewerEnv = { ...process.env };
  if (config.pythonBin) {
    viewerEnv.VIEWER_CAD_PYTHON = config.pythonBin;
    viewerEnv.CAD_PYTHON = config.pythonBin;
  }
  viewerEnv.VIEWER_CAD_PYTHONPATH = [cadpySrc, viewerEnv.VIEWER_CAD_PYTHONPATH]
    .filter(Boolean)
    .join(path.delimiter);

  childProcess = spawn(process.execPath, args, {
    cwd: viewerPackageRoot(),
    detached: true,
    stdio: 'ignore',
    env: viewerEnv,
  });
  childProcess.unref();
}

async function waitForViewer() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const url = await discoverViewerUrl();
    if (url) return url;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('CAD Viewer did not become ready in time. Check viewer/ npm install.');
}

export async function getActiveViewerUrl() {
  if (config.viewerUrl && isExternalViewerUrl(config.viewerUrl)) {
    return config.viewerUrl.replace(/\/$/, '');
  }

  if (cachedBaseUrl) {
    const stillUp = await probeViewer(HOST, new URL(cachedBaseUrl).port);
    if (stillUp) return cachedBaseUrl;
    cachedBaseUrl = '';
  }

  const discovered = await discoverViewerUrl();
  if (discovered) {
    cachedBaseUrl = discovered;
    return discovered;
  }

  if (!config.autoStartViewer) {
    return config.viewerUrl || `http://${HOST}:${PORT_START}`;
  }

  if (!startingPromise) {
    startingPromise = (async () => {
      console.log('[viewer] starting CAD Viewer…');
      await installViewerDeps();
      spawnViewer();
      const url = await waitForViewer();
      cachedBaseUrl = url;
      console.log(`[viewer] ready at ${url}/`);
      return url;
    })().finally(() => {
      startingPromise = null;
    });
  }

  return startingPromise;
}

export async function ensureViewerRunning() {
  if (!config.autoStartViewer) {
    const url = await discoverViewerUrl();
    if (url) {
      cachedBaseUrl = url;
      console.log(`[viewer] detected at ${url}/`);
    } else {
      console.log(`[viewer] not running — start with: npm run dev (from apps/) or set AUTO_START_VIEWER=true`);
    }
    return url || config.viewerUrl;
  }
  return getActiveViewerUrl();
}
