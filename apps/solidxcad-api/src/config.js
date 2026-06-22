import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function originFromUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return '';
  }
}

const configuredCorsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const viewerOrigin = originFromUrl(process.env.VIEWER_URL || '');

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  appName: process.env.APP_NAME || 'SolidX CAD',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@equvinoxis.com',

  frontendUrl: required('FRONTEND_URL', 'http://localhost:3000'),
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`,
  corsOrigins: [...new Set([
    ...configuredCorsOrigins,
    ...(viewerOrigin ? [viewerOrigin] : []),
  ])],

  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpire: process.env.JWT_EXPIRE || '7d',

  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET_NAME || '',
    prefix: process.env.S3_FOLDER_PREFIX || 'solidxcad',
    publicUrl: process.env.S3_PUBLIC_URL || '',
    cloudfront: (process.env.AWS_CLOUDFRONT_DOMAIN || '').replace(/\/$/, ''),
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    proAmountUsd: Number(process.env.PRO_PLAN_AMOUNT_USD || 20),
    proCredits: Number(process.env.CREDITS_PRO_MONTHLY || 500),
  },

  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    user: process.env.GMAIL_USER || process.env.MAIL_USER || '',
    redirectUri: process.env.GMAIL_REDIRECT_URI || '',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  mail: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || process.env.MAIL_USER || '',
    provider: process.env.MAIL_PROVIDER || 'gmail',
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    modelFast: process.env.OPENROUTER_MODEL_FAST || 'anthropic/claude-opus-4.7',
    modelCad: process.env.OPENROUTER_MODEL_CAD || 'anthropic/claude-opus-4.7',
    modelFallback: process.env.OPENROUTER_MODEL_FALLBACK || 'anthropic/claude-opus-4.7',
    maxTokens: Number(process.env.OPENROUTER_MAX_TOKENS || 8192),
    appName: process.env.OPENROUTER_APP_NAME || 'SolidX CAD',
    siteUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  credits: {
    freeSignup: Number(process.env.CREDITS_FREE_SIGNUP || 100),
    // Default ON — set CREDITS_UNLIMITED=false in production to enforce limits
    unlimited: process.env.CREDITS_UNLIMITED !== 'false',
    displayUnlimited: 999999,
  },

  textToCadRoot: process.env.TEXT_TO_CAD_ROOT
    || path.resolve(__dirname, '../../..'),
  pythonBin: process.env.PYTHON_BIN || '',

  pinecone: {
    apiKey: process.env.PINECONE_API_KEY || '',
    indexHost: process.env.PINECONE_INDEX_HOST || '',
    namespace: process.env.PINECONE_NAMESPACE || '__default__',
    topK: Number(process.env.PINECONE_TOP_K || 5),
    /** Integrated indexes (e.g. llama-text-embed-v2, 1024 dim) use text search — not OpenRouter embeddings */
    integratedEmbed: process.env.PINECONE_INTEGRATED_EMBED !== 'false',
    textField: process.env.PINECONE_TEXT_FIELD || 'text',
    embedModel: process.env.PINECONE_EMBED_MODEL || 'openai/text-embedding-3-small',
  },

  viewerUrl: process.env.VIEWER_URL || 'http://127.0.0.1:4178',
  autoStartViewer: process.env.AUTO_START_VIEWER !== 'false' && (process.env.NODE_ENV || 'development') === 'development',
  viewerCatalogTokenExpire: process.env.VIEWER_CATALOG_TOKEN_EXPIRE || '1h',
  viewerCloudMode: (() => {
    if (process.env.VIEWER_CLOUD_MODE === 'true') return true;
    if (process.env.VIEWER_CLOUD_MODE === 'false') return false;
    const viewerUrl = process.env.VIEWER_URL || '';
    const isLocalViewer = !viewerUrl
      || viewerUrl.includes('127.0.0.1')
      || viewerUrl.includes('localhost');
    const isProd = (process.env.NODE_ENV || 'development') === 'production';
    return isProd && !isLocalViewer && process.env.AUTO_START_VIEWER === 'false';
  })(),
  slicerProfilePath: process.env.SLICER_PROFILE_PATH || '',
  slicerBackend: (process.env.SLICER_BACKEND || 'builtin').toLowerCase(),
  orcaSlicerBin: process.env.ORCASLICER_BIN || '',
  prusaSlicerBin: process.env.PRUSASLICER_BIN || '',
  // local | s3 — development may use local; production defaults to s3 when bucket is set
  storageBackend: (() => {
    if (process.env.STORAGE_BACKEND) return process.env.STORAGE_BACKEND.toLowerCase();
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    if (isDev) return 'local';
    return process.env.AWS_S3_BUCKET_NAME ? 's3' : 'local';
  })(),
};
