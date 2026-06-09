const BASE_URL = 'http://localhost:8000/api/chat';

/**
 * Send a message to the RAG forensic chatbot.
 * @param {string} query - The analyst's question.
 * @returns {Promise<{answer: string, sources: string[], risk_flags: string[]}>}
 */
export async function sendMessage(query) {
  const response = await fetch(`${BASE_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch the current windowed conversation history (up to k=6 turns).
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export async function fetchHistory() {
  const response = await fetch(`${BASE_URL}/history`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `History fetch error: ${response.status}`);
  }
  return response.json();
}

/**
 * Clear the conversation memory on the server.
 * @returns {Promise<{status: string}>}
 */
export async function clearHistory() {
  const response = await fetch(`${BASE_URL}/history`, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Clear error: ${response.status}`);
  }
  return response.json();
}

/**
 * Check health of the RAG chatbot subsystem (Qdrant connectivity etc.).
 * @returns {Promise<{status: string, qdrant: string, model: string}>}
 */
export async function checkHealth() {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) throw new Error('Health check failed');
  return response.json();
}
