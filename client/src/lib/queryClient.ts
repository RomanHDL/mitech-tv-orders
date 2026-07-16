import { QueryClient, type QueryFunction } from '@tanstack/react-query'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function throwIfNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error || message
    } catch {
      // respuesta sin JSON
    }
    throw new ApiError(res.status, message)
  }
}

// Cliente fetch para mutaciones. `credentials: 'include'` es obligatorio:
// la sesión vive en una cookie (connect-pg-simple), no en localStorage.
export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: 'include',
  })
  await throwIfNotOk(res)
  return res
}

export function getQueryFn<T>(options: { on401?: 'returnNull' } = {}): QueryFunction<T> {
  return async ({ queryKey }) => {
    const res = await fetch(queryKey.join('/') as string, { credentials: 'include' })
    if (options.on401 === 'returnNull' && res.status === 401) {
      return null as T
    }
    await throwIfNotOk(res)
    return res.json()
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({}),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})
