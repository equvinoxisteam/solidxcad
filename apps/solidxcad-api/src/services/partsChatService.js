import { searchStepParts } from './cadWorker.js';
import { importStepPart } from './partsImport.js';
import { syncProjectWorkspace } from './projectWorkspace.js';

const IMPORT_RE = /\b(import|add|fetch|get|use)\b.*\b(screw|bearing|bolt|washer|fastener|motor|part|catalog)\b/i;
const PART_QUERY_RE = /\b(m\d+\s*(?:x\s*[\d.]+)?\s*(?:screw|bolt|washer|bearing)?|socket\s*head|deep\s*groove|ball\s*bearing|raspberry\s*pi|arduino|nema)\b/i;

export function wantsPartsImport(userMessage = '') {
  return IMPORT_RE.test(userMessage) || PARTS_ONLY_QUERY(userMessage);
}

function PARTS_ONLY_QUERY(msg) {
  return PART_QUERY_RE.test(msg) && !/\b(make|build|design|create|bracket|box|enclosure)\b/i.test(msg);
}

export function extractPartsQuery(userMessage = '') {
  const m = userMessage.match(PART_QUERY_RE);
  if (m) return m[0].trim();
  const cleaned = userMessage
    .replace(/\b(import|add|from step\.parts|catalog|please|the|a|an)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 80) || userMessage.trim().slice(0, 80);
}

export async function importPartFromChat({ userId, projectId, userMessage, onProgress = () => {} }) {
  const query = extractPartsQuery(userMessage);
  onProgress(`Searching step.parts for "${query}"…`);

  const data = await searchStepParts(query);
  const list = data.parts || data.items || data.results || (Array.isArray(data) ? data : []);
  const part = list[0];
  if (!part) {
    return { ok: false, skill: 'step-parts', error: `No parts found for "${query}"` };
  }

  const label = part.name || part.title || part.id;
  onProgress(`Importing ${label} from step.parts…`);

  const fileDoc = await importStepPart({
    userId,
    projectId,
    partId: part.id,
    partUrl: part.stepUrl,
    name: part.name || part.title,
  });

  onProgress(`✓ Imported parts/${fileDoc.name}`);
  return { ok: true, skill: 'step-parts', file: fileDoc, part };
}
