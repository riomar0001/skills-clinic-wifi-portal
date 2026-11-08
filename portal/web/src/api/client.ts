/** Thin fetch wrapper for the portal API. Every unsafe request carries the header the server requires. */

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const TIMEOUT_MS = 15_000

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await send(method, path, body)
  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw errorFrom(response, data)
  return data as T
}

/** POSTs and returns the answer as a file (e.g. a backup) with the name the server gave it. */
async function postForFile(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const response = await send('POST', path, body)
  if (!response.ok) throw errorFrom(response, await response.json().catch(() => null))
  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')
  return { blob: await response.blob(), filename: match?.[1] ?? 'download' }
}

function errorFrom(response: Response, data: unknown): ApiError {
  const detail =
    data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string'
      ? data.detail
      : `Request failed (${response.status}).`
  return new ApiError(response.status, detail)
}

async function send(method: Method, path: string, body?: unknown): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'wifi-portal',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError'
    throw new ApiError(0, timedOut ? 'The server took too long to answer.' : 'Can’t reach the portal server.')
  } finally {
    clearTimeout(timer)
  }
  return response
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postForFile,
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}
