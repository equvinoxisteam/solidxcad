import { config } from '../config.js';
import { matchEngineeringReference } from './engineeringReference.js';

function normalizePineconeHost(host) {
  return String(host || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Integrated index (llama-text-embed-v2): Pinecone embeds query text server-side. */
async function queryPineconeIntegrated(userMessage) {
  const { apiKey, indexHost, namespace, topK, textField } = config.pinecone;
  if (!apiKey || !indexHost) return '';

  const host = normalizePineconeHost(indexHost);
  const ns = namespace || '__default__';
  const res = await fetch(`https://${host}/records/namespaces/${encodeURIComponent(ns)}/search`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-Api-Version': '2025-01',
    },
    body: JSON.stringify({
      query: {
        inputs: { text: String(userMessage).slice(0, 8000) },
        top_k: topK || 5,
      },
      fields: [textField, 'text', 'content', 'chunk_text'],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn('[knowledge] Pinecone integrated search failed:', res.status, detail.slice(0, 200));
    return '';
  }

  const json = await res.json();
  const hits = json?.result?.hits || json?.results?.hits || [];
  const chunks = hits
    .filter((h) => (typeof h?.score === 'number' ? h.score > 0.5 : true))
    .map((h) => {
      const fields = h.fields || h.metadata || {};
      return fields[textField] || fields.text || fields.content || fields.chunk_text || '';
    })
    .filter(Boolean);

  return chunks.length ? chunks.join('\n\n') : '';
}

/** Legacy vector index: embed via OpenRouter then query by vector. */
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

async function queryPineconeVector(userMessage) {
  const { apiKey, indexHost, namespace, topK } = config.pinecone;
  if (!apiKey || !indexHost) return '';

  const vector = await embedQuery(userMessage);
  if (!vector?.length) return '';

  const host = normalizePineconeHost(indexHost);
  const res = await fetch(`https://${host}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2025-01',
    },
    body: JSON.stringify({
      namespace: namespace || '__default__',
      topK: topK || 5,
      includeMetadata: true,
      vector,
    }),
  });

  if (!res.ok) return '';

  const json = await res.json();
  const chunks = (json?.matches || [])
    .filter((m) => (typeof m?.score === 'number' ? m.score > 0.72 : true))
    .map((m) => m.metadata?.text || m.metadata?.content || '')
    .filter(Boolean);

  return chunks.length ? chunks.join('\n\n') : '';
}

async function queryPinecone(userMessage) {
  if (config.pinecone.integratedEmbed) {
    return queryPineconeIntegrated(userMessage);
  }
  return queryPineconeVector(userMessage);
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
