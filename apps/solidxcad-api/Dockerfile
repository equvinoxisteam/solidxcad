# SolidX CAD API — Node + Python CAD + generator skills
# Railway: dockerfilePath=apps/solidxcad-api/Dockerfile, build context = repo root

FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    libgl1 libglib2.0-0 libgomp1 libxrender1 libsm6 libxext6 \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV TEXT_TO_CAD_ROOT=/app/repo
ENV PYTHON_BIN=/opt/venv/bin/python
ENV NODE_ENV=production
ENV AUTO_START_VIEWER=false
ENV VIEWER_CLOUD_MODE=true
ENV STORAGE_BACKEND=s3

WORKDIR /app/repo

COPY packages/cadpy ./packages/cadpy
COPY packages/cadpy_metadata ./packages/cadpy_metadata
COPY skills/cad ./skills/cad
COPY skills/urdf ./skills/urdf
COPY skills/srdf ./skills/srdf
COPY skills/sdf ./skills/sdf
COPY skills/implicit-cad ./skills/implicit-cad

RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install -e ./packages/cadpy -e ./packages/cadpy_metadata \
 && /opt/venv/bin/pip install ezdxf trimesh

# implicit.js → STL/GLB export (optional mesh sidecars from chat)
WORKDIR /app/repo/skills/implicit-cad/scripts/packages/implicitjs
RUN npm ci --omit=dev

WORKDIR /app/api

COPY apps/solidxcad-api/package*.json ./
RUN npm ci --omit=dev

COPY apps/solidxcad-api/src ./src
COPY apps/solidxcad-api/config ./config

EXPOSE 4000

CMD ["node", "src/index.js"]
