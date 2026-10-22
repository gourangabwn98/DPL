export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : {
        'Content-Type': 'application/json'
      }),
      ...options.headers
    }
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server returned an unexpected response. Please try again.');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const statusHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`
});
export const statusLabel = (s: string) => ({
  AWAITING_PAYMENT: 'Awaiting Payment',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
})[s] || s;
