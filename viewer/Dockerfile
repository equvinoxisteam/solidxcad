# CAD Viewer — http-catalog backend for SolidX CAD cloud
# Railway: builder=DOCKERFILE, dockerfilePath=viewer/Dockerfile
# Build context: text-to-cad repository root

FROM node:20-bookworm

WORKDIR /app/viewer

COPY viewer/package*.json ./
COPY viewer/packages ./packages

RUN npm ci

COPY viewer ./

ENV VIEWER_ASSET_BACKEND=http-catalog
ENV NODE_ENV=production
ENV PORT=4178

RUN npm run build

EXPOSE 4178

CMD ["node", "src/server/server.mjs", "--host", "0.0.0.0"]
