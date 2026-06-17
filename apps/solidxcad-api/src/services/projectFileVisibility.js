/** Python sidecars stay in S3 for the pipeline but are hidden from workspace UI. */
export function isUserVisibleProjectFile(file = {}) {
  const name = String(file.name || '');
  const kind = String(file.kind || '').toLowerCase();
  if (/\.py$/i.test(name)) return false;
  if (kind === 'python' || kind === 'script' || kind === 'py') return false;
  return true;
}

export function filterUserVisibleFiles(files = []) {
  return files.filter(isUserVisibleProjectFile);
}
