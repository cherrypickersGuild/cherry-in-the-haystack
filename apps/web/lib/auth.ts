/**
 * Auth — centralized token handling.
 *
 * Policy:
 *   - "Logged in" means: a valid accessToken exists in localStorage.
 *   - On API 401: try refresh → retry original request. If refresh fails → redirect to /login.
 *   - No persistent "isLoggedIn" boolean state. UI reacts to `auth:changed` events.
 *
 * Usage:
 *   - Server auth'd calls:    await fetchWithAuth(url, init)
 *   - React re-render on auth change: useAuthTick()  (then read getAccessToken() directly)
 *   - One-off token read:     getAccessToken()
 *   - Logout:                 clearAccessToken()
 *
 * Important: never cache the token value in React state. Read it fresh via
 * getAccessToken() on each render. The hook above just forces re-render.
 */

import { useEffect, useState } from "react"

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

const TOKEN_KEY = "accessToken"
const AUTH_EVENT = "auth:changed"

/* ══════════════════════════════════════════════════════
   Token storage
   ══════════════════════════════════════════════════════ */

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

/** Bearer header (or empty object if no token). */
export function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/* ══════════════════════════════════════════════════════
   JWT payload decode (role, id, etc)
   — Unsigned decode only, for UI hints. Never trust server-side.
   ══════════════════════════════════════════════════════ */

export interface JwtPayload {
  id?: string
  role?: string
  exp?: number
  [k: string]: unknown
}

export function decodeToken(token: string | null = getAccessToken()): JwtPayload | null {
  if (!token) return null
  try {
    return JSON.parse(atob(token.split(".")[1])) as JwtPayload
  } catch {
    return null
  }
}

/* ══════════════════════════════════════════════════════
   Refresh flow
   ══════════════════════════════════════════════════════ */

let refreshInFlight: Promise<string | null> | null = null

/**
 * Try to refresh the access token using the refresh cookie.
 * Concurrent callers share a single request (dedup).
 * Returns new access token on success, null otherwise.
 */
export async function tryRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/app-user/refresh`, {
        method: "POST",
        credentials: "include", // refresh token is in httpOnly cookie
      })
      if (!res.ok) return null
      const data = (await res.json()) as { accessToken?: string }
      if (!data?.accessToken) return null
      setAccessToken(data.accessToken)
      return data.accessToken
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

/** Clear token and hard-redirect to /login (forces full state reset). */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return
  clearAccessToken()
  // Use location.href to drop SPA state on purpose.
  window.location.href = "/login"
}

/* ══════════════════════════════════════════════════════
   fetchWithAuth — wrapper for authenticated API calls
   ══════════════════════════════════════════════════════ */

/**
 * Authenticated fetch. On 401:
 *   1. Try refresh.
 *   2. If refresh succeeds → retry original request with new token.
 *   3. If refresh fails → clear token + redirect to /login, throw AuthError.
 */
export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const doFetch = (): Promise<Response> =>
    fetch(input, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), ...authHeaders() },
      credentials: init.credentials ?? "include",
    })

  let res = await doFetch()
  if (res.status !== 401) return res

  const newToken = await tryRefresh()
  if (!newToken) {
    redirectToLogin()
    throw new AuthError("Session expired")
  }

  res = await doFetch()
  return res
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}

/* ══════════════════════════════════════════════════════
   React re-render trigger on auth change
   — Does NOT cache token state. Always read via getAccessToken() at render time
     to avoid stale/out-of-sync values with localStorage (source of truth).
   ══════════════════════════════════════════════════════ */

/**
 * Subscribe to auth-change events and force a re-render when they fire.
 * Returns nothing — caller reads `getAccessToken()` / `decodeToken()` directly
 * at render time to guarantee the freshest value from localStorage.
 *
 * Usage:
 *   useAuthTick()
 *   const token = getAccessToken()
 *   const role = decodeToken(token)?.role ?? null
 */
export function useAuthTick(): void {
  const [, force] = useState(0)
  useEffect(() => {
    const h = () => force((t) => t + 1)
    window.addEventListener(AUTH_EVENT, h)
    window.addEventListener("storage", h) // cross-tab sync
    return () => {
      window.removeEventListener(AUTH_EVENT, h)
      window.removeEventListener("storage", h)
    }
  }, [])
}
