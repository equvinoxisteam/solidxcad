/** Safe messages for end users — never expose stack traces, vendor names, or internals. */

export const USER_ERRORS = {
  chat: 'Design paused — please send your message again.',
  cad: 'Model not ready yet — try a simpler prompt or send again.',
  slice: 'Slicing did not finish — check the mesh and try again.',
  parts: 'Part import did not complete — try naming the hardware again.',
  urdf: 'Robot model not ready — try again or describe the mechanism.',
  srdf: 'SRDF not ready — try again after your URDF is in the workspace.',
  sdf: 'Simulation model not ready — try again.',
  implicit: 'Implicit model not ready — try again.',
  sendcutsend: 'Preflight not ready — generate a sheet part first, then retry.',
  sync: 'Workspace sync is catching up — refresh or try again.',
  viewer: 'Workbench is still loading — refresh or try again shortly.',
  auth: 'That did not work — check your details and try again.',
  billing: 'Payment could not be completed — try again or use another method.',
  upload: 'Upload did not complete — try again.',
  noMesh: 'Generate a printable mesh first, then ask to slice.',
  noCode: 'Need a bit more detail — describe size, shape, or what to change.',
  generic: 'Something went wrong — please try again.',
};

const ALLOWED = [
  /insufficient credits/i,
  /out of design credits/i,
  /add credits/i,
  /upgrade to pro/i,
  /log in again/i,
  /verification code/i,
  /invalid code/i,
  /code expired/i,
  /too many attempts/i,
  /request a new code/i,
  /wrong password/i,
  /email already/i,
  /google sign-in is not configured/i,
  /project not found/i,
  /projectid and message required/i,
];

export function isAllowedUserMessage(message = '') {
  const msg = String(message || '').trim();
  if (!msg) return false;
  return ALLOWED.some((re) => re.test(msg));
}

/** Map raw/internal errors to a safe user message. Real errors stay in server logs only. */
export function userFacingError(raw = '', context = 'generic') {
  const msg = String(raw || '').trim();
  if (msg && isAllowedUserMessage(msg)) return msg;
  return USER_ERRORS[context] || USER_ERRORS.generic;
}

export function userFacingHttpError(err, context = 'generic') {
  console.error('[user-facing]', context, err?.message || err);
  const status = err?.status || err?.statusCode || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  return {
    status: safeStatus >= 500 ? 500 : safeStatus,
    body: { error: userFacingError(err?.message, context) },
  };
}
