/** Client-side safe copy — never show API/stack details to users. */

export const USER_ERRORS = {
  chat: 'Design paused — please send your message again.',
  cad: 'Model not ready yet — try a simpler prompt or send again.',
  slice: 'Slicing did not finish — check the mesh and try again.',
  load: 'Could not load right now — refresh the page and try again.',
  save: 'Could not save — try again in a moment.',
  auth: 'That did not work — check your details and try again.',
  billing: 'Payment could not be completed — try again or use another method.',
  upload: 'Upload did not complete — try again.',
  network: 'Connection issue — check your network and try again.',
  generic: 'Something went wrong — please try again.',
} as const;

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
  /verification email/i,
  /google sign-in/i,
  /deliver the verification/i,
  /email verification is temporarily/i,
];

export function isAllowedUserMessage(message = '') {
  const msg = String(message || '').trim();
  if (!msg) return false;
  return ALLOWED.some((re) => re.test(msg));
}

export function sanitizeUserError(
  raw?: string,
  context: keyof typeof USER_ERRORS = 'generic',
): string {
  const msg = String(raw || '').trim();
  if (msg && isAllowedUserMessage(msg)) return msg;
  return USER_ERRORS[context] || USER_ERRORS.generic;
}
