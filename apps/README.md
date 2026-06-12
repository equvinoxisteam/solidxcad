# SolidX CAD — Local dev

## One command (recommended)

```powershell
cd apps
npm run dev
```

This starts:

- **API** on http://localhost:4000 (auto-starts **CAD Viewer** on port 4178+)
- **Web** on http://localhost:3000

## Test flow

1. Open http://localhost:3000
2. Login or register
3. Create a project → open studio
4. Chat: *"Simple box 20x30x10mm"* (CAD skill) or *"simple 2-link robot arm URDF"* (URDF skill)
5. **Files** — STEP/STL or `.urdf` appear
6. **Mesh** tab — rotate STL preview
7. **CAD Viewer** tab — STEP / URDF / G-code preview

Full skills checklist: [SKILLS_TESTING.md](./SKILLS_TESTING.md)

First API start may run `npm install` in `viewer/` (one-time, ~2 min).

## Env

Copy `solidxcad-api/.env.example` → `.env` and fill MongoDB, OpenRouter, and (optionally) AWS keys.

For local dev without S3, leave `STORAGE_BACKEND=auto` (default) — files save to `tmp/solidxcad-storage/` when S3 is missing or returns Access Denied.

Key viewer settings (already in `.env.example`):

```env
VIEWER_URL=http://127.0.0.1:4178
AUTO_START_VIEWER=true
```

## Slice tab (optional)

Requires OrcaSlicer or PrusaSlicer + `SLICER_PROFILE_PATH` in API `.env`.
