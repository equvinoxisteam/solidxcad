import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDb } from './db.js';
import { syncAllUsersUnlimited } from './services/usage.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import agentRoutes from './routes/agent.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import assetRoutes from './routes/assets.js';
import viewerRoutes from './routes/viewer.js';
import manufacturingRoutes from './routes/manufacturing.js';
import { ensureViewerRunning } from './services/viewerLauncher.js';

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.nodeEnv === 'development') {
      if (
        origin.startsWith('http://localhost:')
        || origin.startsWith('http://127.0.0.1:')
        || /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
    }
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    app: config.appName,
    env: config.nodeEnv,
    storage: config.storageBackend,
    s3Bucket: config.aws.bucket ? true : false,
    openrouter: Boolean(config.openrouter.apiKey),
    unlimitedCredits: config.credits.unlimited,
    pythonBin: config.pythonBin || null,
    textToCadRoot: config.textToCadRoot,
    viewerCloudMode: config.viewerCloudMode,
    viewerUrl: config.viewerUrl,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/viewer', viewerRoutes);
app.use('/api/manufacturing', manufacturingRoutes);

app.use((err, req, res, next) => {
  console.error('[api error]', req.method, req.path, err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

async function main() {
  await connectDb();

  if (config.credits.unlimited) {
    const { updated } = await syncAllUsersUnlimited();
    if (updated > 0) {
      console.log(`[api] upgraded ${updated} user(s) to unlimited pro access`);
    }
  }

  ensureViewerRunning().catch((err) => {
    console.warn('[viewer] auto-start failed:', err.message);
  });

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[api] ${config.appName} listening on :${config.port}`);
    console.log(`[api] frontend: ${config.frontendUrl}`);
    console.log(`[api] storage: ${config.storageBackend}${config.aws.bucket ? ` (bucket: ${config.aws.bucket})` : ''}`);
    if (config.credits.unlimited) {
      console.log('[api] credits: UNLIMITED (all users)');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[api] Port ${config.port} is already in use.`);
      console.error('[api] Run: npm run dev  (auto-kills old process) or close the other terminal.');
      process.exit(1);
    }
    throw err;
  });
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
