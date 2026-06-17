# SolidX CAD API — Node + Python CAD + generator skills + OrcaSlicer
# Railway: dockerfilePath=apps/solidxcad-api/Dockerfile, build context = repo root

FROM node:20-bookworm

ARG ORCA_SLICER_VERSION=v2.3.2

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    libgl1 libglib2.0-0 libgomp1 libxrender1 libsm6 libxext6 \
    libfuse2 libgtk-3-0 libnotify4 libnss3 libxss1 libasound2 \
    xvfb curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV TEXT_TO_CAD_ROOT=/app/repo
ENV PYTHON_BIN=/opt/venv/bin/python
ENV NODE_ENV=production
ENV AUTO_START_VIEWER=false
ENV VIEWER_CLOUD_MODE=true
ENV STORAGE_BACKEND=s3

# OrcaSlicer (headless slice via Xvfb in docker-entrypoint.sh)
RUN mkdir -p /opt/orcaslicer \
 && curl -fsSL -o /tmp/orca.AppImage \
    "https://github.com/OrcaSlicer/OrcaSlicer/releases/download/${ORCA_SLICER_VERSION}/OrcaSlicer_Linux_V2.3.2.AppImage" \
 && chmod +x /tmp/orca.AppImage \
 && cd /opt/orcaslicer \
 && /tmp/orca.AppImage --appimage-extract \
 && mv squashfs-root app \
 && rm /tmp/orca.AppImage

ENV ORCASLICER_BIN=/opt/orcaslicer/app/AppRun
ENV ORCASLICER_ROOT=/opt/orcaslicer/app
ENV SLICER_PROFILE_PATH=/app/api/config/orcaslicer-ender3-pla.json

WORKDIR /app/repo

COPY packages/cadpy ./packages/cadpy
COPY packages/cadpy_metadata ./packages/cadpy_metadata
COPY skills/cad ./skills/cad
COPY skills/urdf ./skills/urdf
COPY skills/srdf ./skills/srdf
COPY skills/sdf ./skills/sdf
COPY skills/implicit-cad ./skills/implicit-cad
COPY skills/gcode ./skills/gcode

RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install -e ./packages/cadpy -e ./packages/cadpy_metadata \
 && /opt/venv/bin/pip install ezdxf trimesh build123d

# implicit.js → STL/GLB export (optional mesh sidecars from chat)
WORKDIR /app/repo/skills/implicit-cad/scripts/packages/implicitjs
RUN npm ci --omit=dev

WORKDIR /app/api

COPY apps/solidxcad-api/package*.json ./
RUN npm ci --omit=dev

COPY apps/solidxcad-api/src ./src
COPY apps/solidxcad-api/config ./config
COPY apps/solidxcad-api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
