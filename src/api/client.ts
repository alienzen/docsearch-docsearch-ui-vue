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
/**
 * Met le `detail` de l'API en phrase affichable.
 *
 * Nos routes renvoient une chaîne, mais une erreur de VALIDATION FastAPI
 * (422) renvoie une LISTE d'objets `{loc, msg, type}`. Concaténée telle
 * quelle dans un message, elle s'affichait « [object Object] » — une
 * erreur illisible, donc un bug indiagnosticable depuis l'écran.
 */
function detailToMessage(detail: unknown, status: number): string {
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === 'string') return d
        const item = d as { loc?: unknown[]; msg?: string }
        const where = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body').join('.') : ''
        return where ? `${where} : ${item.msg}` : item.msg
      })
      .filter(Boolean)
    if (parts.length) return parts.join(' ; ')
  }
  return `Erreur ${status}`
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { detail?: unknown })
    throw new ApiError(detailToMessage(body.detail, res.status), res.status)
  }
  return res.json() as Promise<T>
}
