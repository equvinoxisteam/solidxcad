import { config } from '../config.js';
import { matchEngineeringReference } from './engineeringReference.js';

async function embedQuery(text) {
  if (!config.openrouter.apiKey) return null;
  const res = await fetch(`${config.openrouter.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openrouter.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.pinecone.embedModel,
      input: String(text).slice(0, 8000),
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.[0]?.embedding || null;
}

async function queryPinecone(userMessage) {
  const { apiKey, indexHost, namespace, topK } = config.pinecone;
  if (!apiKey || !indexHost) return '';

  const vector = await embedQuery(userMessage);
  if (!vector?.length) return '';

  const host = indexHost.replace(/\/$/, '');
  const res = await fetch(`https://${host}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2025-01',
    },
    body: JSON.stringify({
      namespace: namespace || 'engineering',
      topK: topK || 5,
      includeMetadata: true,
      vector,
    }),
  });

  if (!res.ok) return '';

  const json = await res.json();
  const chunks = (json?.matches || [])
    .filter((m) => typeof m?.score === 'number' ? m.score > 0.72 : true)
    .map((m) => m.metadata?.text || m.metadata?.content || '')
    .filter(Boolean);

  return chunks.length ? chunks.join('\n\n') : '';
}

/**
 * Retrieve engineering context: local keyword snippets + optional Pinecone RAG.
 */
export async function retrieveKnowledgeContext(userMessage = '', { skill = '' } = {}) {
  const parts = [];
  const local = matchEngineeringReference(userMessage, skill);
  if (local) parts.push(local);

  try {
    const remote = await queryPinecone(userMessage);
    if (remote) parts.push(remote);
  } catch (err) {
    console.warn('[knowledge] Pinecone query skipped:', err.message);
  }

  if (!parts.length) return '';
  return `\n\n---\n## Engineering knowledge (retrieved)\n${parts.join('\n\n')}`;
}

export function knowledgeConfigured() {
  return Boolean(config.pinecone.apiKey && config.pinecone.indexHost);
}
