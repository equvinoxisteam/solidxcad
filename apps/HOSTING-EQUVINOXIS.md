# SolidX CAD — Full hosting guide (Railway + GoDaddy)

**Your production URLs**

| Service | URL |
|---------|-----|
| Web (app) | `https://solidxcad.equvinoxis.com` |
| API | `https://api.solidxcad.equvinoxis.com` |
| CAD Viewer | `https://viewer.solidxcad.equvinoxis.com` |

**GitHub repo:** `https://github.com/equvinoxisteam/solidxcad.git`  
**Railway:** 1 project → **3 services** (same repo, different roots/Dockerfiles)

---

## Part A — Push code to GitHub

Run from your machine in the **`text-to-cad`** folder (repo root — contains `apps/`, `viewer/`, `skills/`).

### 1. One-time: point Git at your new repo

```powershell
cd "C:\Users\LENOVO\Desktop\3d_launch - Copy\text-to-cad"

git remote remove origin
git remote add origin https://github.com/equvinoxisteam/solidxcad.git

git branch -M main
```

### 2. Commit everything (do NOT commit `.env` — it is gitignored)

```powershell
git add apps/ viewer/ .dockerignore
git add viewer/Dockerfile viewer/railway.toml viewer/src/server/httpCatalogAssetBackend.mjs
git add apps/solidxcad-api/Dockerfile apps/solidxcad-api/railway.toml
git status
```

Review `git status`. Ensure **no** `apps/solidxcad-api/.env` is staged.

```powershell
git commit -m "Add SolidX CAD portal apps, cloud Dockerfiles, and viewer http-catalog backend"
git push -u origin main
```

If the remote repo already has a README commit:

```powershell
git pull origin main --rebase
git push -u origin main
```

Use a [GitHub Personal Access Token](https://github.com/settings/tokens) as password when Git asks.

---

## Part B — Railway: one project, three services

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select **`equvinoxisteam/solidxcad`**
3. Railway creates a first service — rename it and add two more (below).

You will have:

| # | Service name | Purpose |
|---|--------------|---------|
| 1 | `solidxcad-api` | Node + Python CAD |
| 2 | `solidxcad-web` | Next.js UI |
| 3 | `cad-viewer` | CAD Workbench |

Deploy order: **API → Viewer → Web** (then wire domains and env).

---

## Part C — Service 1: `solidxcad-api`

### Settings → Source

| Setting | Value |
|---------|--------|
| **Root Directory** | *(leave empty — repo root)* |
| **Builder** | Dockerfile |
| **Dockerfile path** | `apps/solidxcad-api/Dockerfile` |

(`apps/solidxcad-api/railway.toml` already sets this if Railway reads it.)

### Settings → Networking

- **Generate domain** (temporary) — note URL for testing
- Later add custom domain: **`api.solidxcad.equvinoxis.com`**

### Settings → Variables (paste all)

Copy values from your local `apps/solidxcad-api/.env`. **Never commit `.env`.**

```env
NODE_ENV=production
PORT=4000
APP_NAME=SolidX CAD
SUPPORT_EMAIL=your-support@equvinoxis.com

FRONTEND_URL=https://solidxcad.equvinoxis.com
CLIENT_URL=https://solidxcad.equvinoxis.com
API_URL=https://api.solidxcad.equvinoxis.com
CORS_ORIGINS=https://solidxcad.equvinoxis.com

MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/solidxcad?retryWrites=true&w=majority
JWT_SECRET=long-random-string-min-32-chars
JWT_EXPIRE=7d

STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=eu-north-1
AWS_S3_BUCKET_NAME=indianet-equvinoxis
S3_FOLDER_PREFIX=solidxcad
S3_PUBLIC_URL=https://indianet-equvinoxis.s3.eu-north-1.amazonaws.com

OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL_CAD=anthropic/claude-3.5-haiku
OPENROUTER_MODEL_FAST=anthropic/claude-3.5-haiku
OPENROUTER_MODEL_FALLBACK=google/gemini-2.0-flash-001
OPENROUTER_MAX_TOKENS=1024
CREDITS_UNLIMITED=true

GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

MAIL_USER=your@gmail.com
MAIL_PASS=your-gmail-app-password
MAIL_FROM=your@gmail.com

AUTO_START_VIEWER=false
VIEWER_CLOUD_MODE=true
VIEWER_URL=https://viewer.solidxcad.equvinoxis.com

TEXT_TO_CAD_ROOT=/app/repo
PYTHON_BIN=/opt/venv/bin/python
VIEWER_CATALOG_TOKEN_EXPIRE=1h
```

**Set `VIEWER_URL` only after Service 3 is deployed** (step 4 below). First deploy API without it, then add and redeploy.

### Health check

```bash
curl https://api.solidxcad.equvinoxis.com/health
```

Expect: `"ok":true`, `"storage":"s3"`, `"pythonBin":"/opt/venv/bin/python"`, `"viewerCloudMode":true`

---

## Part D — Service 2: `cad-viewer`

### Settings → Source

| Setting | Value |
|---------|--------|
| **Root Directory** | *(empty — repo root)* |
| **Builder** | Dockerfile |
| **Dockerfile path** | `viewer/Dockerfile` |

### Variables

```env
NODE_ENV=production
PORT=4178
VIEWER_ASSET_BACKEND=http-catalog
```

### Networking

- Custom domain: **`viewer.solidxcad.equvinoxis.com`**

### Then update API

On **`solidxcad-api`** add/update:

```env
VIEWER_URL=https://viewer.solidxcad.equvinoxis.com
AUTO_START_VIEWER=false
VIEWER_CLOUD_MODE=true
```

**Redeploy API.**

---

## Part E — Service 3: `solidxcad-web`

### Settings → Source

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/solidxcad-web` |
| **Builder** | Nixpacks (default) |
| **Build command** | `npm install && npm run build` |
| **Start command** | `npm start` |

### Variables

```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://api.solidxcad.equvinoxis.com
NEXT_PUBLIC_APP_NAME=SolidX CAD
NEXT_PUBLIC_VIEWER_URL=https://viewer.solidxcad.equvinoxis.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=same-as-API-GOOGLE_CLIENT_ID
```

### Networking

- Custom domain: **`solidxcad.equvinoxis.com`**

---

## Part F — GoDaddy DNS (`equvinoxis.com`)

1. Log in to [GoDaddy](https://dcc.godaddy.com/) → **My Products** → **DNS** for **equvinoxis.com**
2. For **each** Railway custom domain, Railway shows a **CNAME target** (e.g. `xxxx.up.railway.app`).

Add these records (replace `TARGET` with the value Railway gives for that service):

| Type | Name / Host | Value | TTL |
|------|-------------|-------|-----|
| **CNAME** | `solidxcad` | Railway target for **web** service | 600 |
| **CNAME** | `api.solidxcad` | Railway target for **api** service | 600 |
| **CNAME** | `viewer.solidxcad` | Railway target for **viewer** service | 600 |

### GoDaddy notes

- **Name** field: enter only the subdomain part:
  - `solidxcad` → `solidxcad.equvinoxis.com`
  - `api.solidxcad` → `api.solidxcad.equvinoxis.com`
  - `viewer.solidxcad` → `viewer.solidxcad.equvinoxis.com`
- Do **not** include `https://` in the value.
- DNS can take **5–60 minutes** (sometimes up to 48h). Use [dnschecker.org](https://dnschecker.org) to verify.
- Delete old conflicting A/CNAME records for the same names if they exist.

### SSL

Railway provisions HTTPS automatically after DNS points correctly. Wait until Railway shows **Valid** on each custom domain.

---

## Part G — Google OAuth (required for Sign in with Google)

[Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **OAuth 2.0 Client ID** → **Web application**

| Field | Value |
|-------|--------|
| Authorized JavaScript origins | `https://solidxcad.equvinoxis.com` |
| Authorized redirect URIs | `https://api.solidxcad.equvinoxis.com/api/auth/google/callback` |

Put **the same** `GOOGLE_CLIENT_ID` on:

- API service variables
- Web service `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

Redeploy API + Web after saving.

---

## Part H — MongoDB Atlas

1. Cluster in **same region** as Railway (e.g. EU) if possible
2. Database name: **`solidxcad`**
3. Network Access → **Allow access from anywhere** (`0.0.0.0/0`) for Railway
4. Connection string in API `MONGODB_URI`

---

## Part I — Full test checklist

After DNS + deploy:

| # | Test | Expected |
|---|------|----------|
| 1 | `https://api.solidxcad.equvinoxis.com/health` | JSON `ok: true`, `pythonBin` set |
| 2 | `https://solidxcad.equvinoxis.com` | Landing / login loads |
| 3 | Register with email OTP | Email arrives |
| 4 | Google sign-in | Redirect works |
| 5 | Dashboard → New project | Project created |
| 6 | Chat: `make a 30mm cube` | STEP in Workspace files |
| 7 | CAD Workbench tab | 3D viewer loads |
| 8 | Workspace → Parts → search M3 | Catalog results |
| 9 | Chat Web toggle + dimension question | Answer uses web grounding |
| 10 | Settings / logout | Works |

---

## Part J — Troubleshooting

| Problem | Fix |
|---------|-----|
| API build fails | Check Dockerfile path; build context must be **repo root** |
| `pythonBin` null | API must use Docker builder, not Nixpacks-only |
| CORS error | `CORS_ORIGINS=https://solidxcad.equvinoxis.com` on API |
| Google login fails | OAuth origins/redirect must match production URLs exactly |
| Viewer blank | `VIEWER_URL` on API + viewer service running + DNS for viewer |
| Chat works, no STEP | Redeploy API with Docker image; check `/health` |
| GoDaddy CNAME on root | Use subdomain `solidxcad` only (not `@` for app) |

---

## Quick reference — which env goes where

| Variable | API | Web | Viewer |
|----------|:---:|:---:|:------:|
| `MONGODB_URI` | ✓ | | |
| `JWT_SECRET` | ✓ | | |
| `AWS_*` / `STORAGE_BACKEND` | ✓ | | |
| `OPENROUTER_API_KEY` | ✓ | | |
| `GOOGLE_CLIENT_*` | ✓ | | |
| `MAIL_*` | ✓ | | |
| `FRONTEND_URL` / `API_URL` / `CORS_ORIGINS` | ✓ | | |
| `VIEWER_URL` / `VIEWER_CLOUD_MODE` | ✓ | | |
| `NEXT_PUBLIC_API_URL` | | ✓ | |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | | ✓ | |
| `NEXT_PUBLIC_VIEWER_URL` | | ✓ | |
| `VIEWER_ASSET_BACKEND` | | | ✓ |

---

## Deploy order (summary)

1. Push code → GitHub `equvinoxisteam/solidxcad`
2. Railway project → deploy **API** (Docker)
3. Deploy **Viewer** (Docker) → domain `viewer.solidxcad.equvinoxis.com`
4. Set API `VIEWER_URL` → redeploy API
5. Deploy **Web** → domain `solidxcad.equvinoxis.com`
6. GoDaddy CNAME × 3
7. Google OAuth URLs
8. Run test checklist
