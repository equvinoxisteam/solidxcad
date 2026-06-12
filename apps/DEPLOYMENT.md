# SolidX CAD — Production Deployment

See **[RAILWAY.md](./RAILWAY.md)** for the full step-by-step Railway guide (3 services: API + Web + Viewer).

| Service | Path | Builder |
|---------|------|---------|
| API | `apps/solidxcad-api/Dockerfile` | Docker (Node + Python CAD) |
| Web | `apps/solidxcad-web` | Nixpacks |
| Viewer | `viewer/Dockerfile` | Docker (http-catalog) |

Health check after API deploy:

```bash
curl https://api.your-domain.com/health
```

Expected: `"pythonBin": "/opt/venv/bin/python"`, `"storage": "s3"`, `"viewerCloudMode": true`
