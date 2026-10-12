export function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = init?.method?.toUpperCase() || 'GET';
  return fetch(input, {
    ...init,
    headers: !['GET', 'HEAD'].includes(method)
      ? { 'X-Anacapa-Client': '1', ...init?.headers }
      : init?.headers,
  });
}
export async function caseAction(id: string, action: string, value: unknown = {}) {
  const r = await apiFetch(`/api/cases/${id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'Could not complete this action.');
  return data;
}
export function downloadBlob(content: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
