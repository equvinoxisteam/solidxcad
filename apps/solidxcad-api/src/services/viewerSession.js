import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const VIEWER_SCOPE = 'viewer-catalog';

export function signViewerCatalogToken({ userId, projectId }) {
  return jwt.sign(
    {
      sub: userId,
      projectId,
      scope: VIEWER_SCOPE,
    },
    config.jwtSecret,
    { expiresIn: config.viewerCatalogTokenExpire },
  );
}

export function verifyViewerCatalogToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (payload.scope !== VIEWER_SCOPE) {
    throw new Error('Invalid viewer token scope');
  }
  if (!payload.projectId || !payload.sub) {
    throw new Error('Invalid viewer token payload');
  }
  return {
    userId: payload.sub,
    projectId: payload.projectId,
  };
}
