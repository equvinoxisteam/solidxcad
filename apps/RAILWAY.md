# Host SolidX CAD on Railway (step by step)

Deploy **3 Railway services** from the `text-to-cad` repo. No local PC required after this.

**What works in cloud:**

| Feature / skill | Cloud? |
|-----------------|--------|
| Sign up / login / Google OAuth | Yes |
| **cad** — STEP / STL / assemblies (build123d) | Yes |
| **step.parts** — search & import catalog parts | Yes (calls api.step.parts over HTTPS) |
| **urdf** — robot descriptions | Yes |
| **srdf** — MoveIt semantic config | Yes |
| **sdf** — Gazebo / SDFormat | Yes |
| **implicit-cad** — `.implicit.js` models | Yes — view in CAD Viewer; mesh export best-effort |
| **sendcutsend** — laser-cut preflight report + DXF | Yes |
| **cad-viewer** — STEP / URDF / implicit in browser | Yes — separate Viewer service |
| Mesh preview (STL in studio) | Yes |
| **gcode** slicing | **Not included** (you chose to skip slicer) |

---

## Before you start

Create accounts and gather credentials:

1. **GitHub** — push the `text-to-cad` repo
2. **Railway** — [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. **MongoDB Atlas** — free cluster, database name `solidxcad`
4. **AWS S3** — bucket + IAM user (`PutObject`, `GetObject`, `ListBucket` on `solidxcad/*`)
5. **OpenRouter** — API key for chat/CAD
6. **Google Cloud** — OAuth Web client for sign-in
7. **Gmail or SMTP** — for email OTP (`MAIL_USER` / `MAIL_PASS`)

---

## Step 1 — Create Railway project

1. Railway → **New Project** → **Deploy from GitHub repo**
2. Select your **`text-to-cad`** repository
3. You will add **3 services** inside this one project

---

## Step 2 — API service (Docker)

This service runs Node + Python so chat can generate real STEP files.

1. **Add service** (or rename the first one) → name it `solidxcad-api`
2. **Settings → Source → Root Directory:** leave **empty** (repo root)
3. **Settings → Build → Builder:** Dockerfile
4. **Dockerfile path:** `apps/solidxcad-api/Dockerfile`
5. **Settings → Networking → Generate domain** → copy URL (e.g. `https://solidxcad-api-production.up.railway.app`)
6. Optional: add custom domain `api.solidxcad.yourdomain.com`

### API variables (Variables tab)

Paste and fill in:

```env
NODE_ENV=production
PORT=4000

FRONTEND_URL=https://YOUR-WEB-URL
API_URL=https://YOUR-API-URL
CORS_ORIGINS=https://YOUR-WEB-URL

MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/solidxcad?retryWrites=true&w=majority
JWT_SECRET=use-a-long-random-string-here

STORAGE_BACKEND=s3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=eu-north-1
AWS_S3_BUCKET_NAME=your-bucket
S3_FOLDER_PREFIX=solidxcad

OPENROUTER_API_KEY=sk-or-v1-...
CREDITS_UNLIMITED=true

GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...

MAIL_USER=your@gmail.com
MAIL_PASS=your-app-password
MAIL_FROM=your@gmail.com

AUTO_START_VIEWER=false
VIEWER_CLOUD_MODE=true
```

Leave `VIEWER_URL` empty for now — set it in Step 4 after the Viewer is deployed.

7. **Deploy** and wait for build (first Docker build may take 5–10 minutes)
8. Test: open `https://YOUR-API-URL/health`

You should see:

```json
{
  "ok": true,
  "storage": "s3",
  "pythonBin": "/opt/venv/bin/python",
  "viewerCloudMode": true
}
```

If `pythonBin` is null, the Dockerfile build failed — check Railway build logs.

---

## Step 3 — Web service (Next.js)

1. **Add service** → name `solidxcad-web`
2. **Root Directory:** `apps/solidxcad-web`
3. **Build command:** `npm install && npm run build`
4. **Start command:** `npm start`
5. **Generate domain** → e.g. `https://solidxcad-web.up.railway.app`
6. Optional custom domain: `solidxcad.yourdomain.com`

### Web variables

```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://YOUR-API-URL
NEXT_PUBLIC_APP_NAME=SolidX CAD
NEXT_PUBLIC_GOOGLE_CLIENT_ID=same-as-api-GOOGLE_CLIENT_ID
```

Leave `NEXT_PUBLIC_VIEWER_URL` empty until Step 4.

7. **Deploy**

---

## Step 4 — CAD Viewer service (Docker)

1. **Add service** → name `cad-viewer`
2. **Root Directory:** empty (repo root)
3. **Dockerfile path:** `viewer/Dockerfile`
4. **Generate domain** → e.g. `https://cad-viewer.up.railway.app`
5. Optional custom domain: `viewer.solidxcad.yourdomain.com`

### Viewer variables

```env
NODE_ENV=production
PORT=4178
VIEWER_ASSET_BACKEND=http-catalog
```

6. **Deploy**

### Wire viewer to API and web

Go back to **API** service → Variables:

```env
VIEWER_URL=https://YOUR-VIEWER-URL
AUTO_START_VIEWER=false
VIEWER_CLOUD_MODE=true
```

Go to **Web** service → Variables:

```env
NEXT_PUBLIC_VIEWER_URL=https://YOUR-VIEWER-URL
```

Update **API** again with final web URL:

```env
FRONTEND_URL=https://YOUR-WEB-URL
CORS_ORIGINS=https://YOUR-WEB-URL
```

**Redeploy API and Web.**

---

## Step 5 — Google OAuth (production)

[Google Cloud Console](https://console.cloud.google.com/apis/credentials) → create **OAuth client ID** → **Web application**:

| Field | Value |
|-------|--------|
| Authorized JavaScript origins | `https://YOUR-WEB-URL` |
| Authorized redirect URIs | `https://YOUR-API-URL/api/auth/google/callback` |

Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the **API** service.  
Put the same client ID in `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on **Web**.

---

## Step 6 — Custom domains (optional)

In Railway, each service → **Settings → Networking → Custom Domain**:

| Service | Example |
|---------|---------|
| Web | `solidxcad.equvinoxis.com` |
| API | `api.solidxcad.equvinoxis.com` |
| Viewer | `viewer.solidxcad.equvinoxis.com` |

Add CNAME records at your DNS host pointing to Railway.  
Update all `FRONTEND_URL`, `API_URL`, `CORS_ORIGINS`, `VIEWER_URL`, `NEXT_PUBLIC_*` to match, then redeploy.

---

## Step 7 — Test end to end

1. Open **Web URL** in browser
2. Register with email OTP or Google sign-in
3. Complete onboarding → Dashboard
4. **New project** → Open studio
5. Chat: `make a 30mm cube`
6. Wait — STEP file appears under **Files**
7. Open **CAD Viewer** tab — 3D model loads
8. Try **Parts** tab — search and import a screw from step.parts
9. Settings, logout, delete project

---

## Architecture

```
User browser
    │
    ├─► Web (Next.js) ──────────► API (Docker: Node + Python)
    │                                  │
    │                                  ├─► MongoDB Atlas
    │                                  └─► AWS S3 (STEP/STL/GLB)
    │
    └─► CAD Viewer iframe ──► catalog from API ──► presigned S3 URLs
```

---

## Local dev vs cloud

| Setting | Local (`npm run dev`) | Railway |
|---------|----------------------|---------|
| `STORAGE_BACKEND` | `s3` or `local` | `s3` |
| `AUTO_START_VIEWER` | `true` | `false` |
| `VIEWER_CLOUD_MODE` | off | `true` |
| `VIEWER_URL` | `http://127.0.0.1:4178` | `https://viewer...` |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Chat works, no STEP file | API must use Docker image; check `/health` → `pythonBin` |
| CAD Viewer blank | Set `VIEWER_URL` on API; viewer service must be running |
| Google sign-in fails | Fix OAuth origins/redirect URIs; match production URLs |
| CORS error | `CORS_ORIGINS` must include the web URL; `VIEWER_URL` origin is merged automatically |
| S3 upload fails | Check `STORAGE_BACKEND=s3` and IAM permissions |

---

## Skills in the API Docker image

The API image bundles these repo skills under `/app/repo/skills/`:

| Skill | Runtime needs | In image? |
|-------|---------------|-----------|
| `cad` | Python + build123d | Yes |
| `urdf` / `srdf` / `sdf` | Python (stdlib XML) | Yes |
| `implicit-cad` | Node implicitjs for optional STL/GLB export | Yes |
| `step-parts` | External HTTPS API only | N/A (no files to copy) |
| `sendcutsend` | Uses `cad` DXF export + markdown report | Yes (via `cad`) |
| `gcode` | OrcaSlicer / PrusaSlicer binary | **No** (not deployed) |

### Cloud viewer notes

- **STEP, STL, GLB, URDF, SRDF, SDF, implicit.js** — load in CAD Viewer via presigned S3 URLs.
- **Assembly tree** — works when the STEP is a multi-part `Compound` and GLB sidecar exists (API generates GLB during CAD export).
- **On-demand STEP→GLB inside the viewer** (local-only feature) — not available in cloud `http-catalog` mode; rely on API-generated sidecars instead.

---

## Summary

Yes — **all skills you use work in the cloud** on Railway (except **gcode/slicer**, which you removed):

- **3 services:** API (Docker), Web (Nixpacks), Viewer (Docker)
- Skills: **cad, urdf, srdf, sdf, implicit-cad, step.parts, sendcutsend, cad-viewer**

Full env reference: `apps/solidxcad-api/.env.example`
