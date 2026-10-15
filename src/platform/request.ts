export class RequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

/** Decode unknown network data at the boundary, before it reaches UI state. */
export async function requestJson<T>(
  url: string,
  decode: (value: unknown) => T,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (!response.ok) throw new RequestError('The request failed. Please try again.', response.status);
  const mediaType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json' && !(mediaType?.startsWith('application/') && mediaType.endsWith('+json'))) {
    throw new RequestError('The server returned an unexpected response.');
  }
  return decode(await response.json());
}
