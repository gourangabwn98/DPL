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
    if (res.status === 413) throw new Error('Upload is too large. Choose an image of 4 MB or smaller.');
    if (res.status >= 500) throw new Error('The tournament service is unavailable. The organiser must check the hosting configuration.');
    if (res.status === 404 || res.headers.get('content-type')?.includes('text/html')) throw new Error('The API route is unavailable. The organiser must check the hosting API routes.');
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
