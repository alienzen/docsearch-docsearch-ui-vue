/**
 * Erreur d'appel API. Le code HTTP est exposé parce que plusieurs
 * écrans s'en servent pour distinguer « pas le droit » (401/403, on
 * masque la fonctionnalité) de « c'est cassé » (on affiche l'erreur).
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Appel JSON à docsearch-api. Portage à l'identique de `api()` de
 * docsearch-ui/public/js/search.js — même contrat : renvoie le corps
 * JSON désérialisé, ou lève une erreur portant `status` et le `detail`
 * renvoyé par l'API (repli sur « Erreur <code> » si le corps n'est pas
 * du JSON exploitable).
 *
 * Toutes les URLs sont relatives : même origine que la page, donc le
 * header d'authentification X-User injecté par le SSO en amont suit
 * automatiquement.
 */
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { detail?: string })
    throw new ApiError(body.detail || `Erreur ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}
