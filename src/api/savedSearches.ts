import { api } from './client'

/**
 * Une recherche enregistrée. Reflète l'état de l'interface, pas les
 * critères résolus envoyés à /search — ce qui permet de restaurer
 * l'écran directement depuis l'enregistrement.
 *
 * `ext`/`author`/`folder`/`keywords`/`source` sont typés `string |
 * string[]` : les enregistrements créés AVANT le passage à la sélection
 * cumulative contiennent une chaîne unique (et `ext` peut valoir la
 * chaîne « all »). Voir toArray()/extList() pour la normalisation.
 */
export type SavedSearch = {
  id: string
  name: string
  query: string
  search_in?: string
  ext?: string | string[]
  author?: string | string[] | null
  keywords?: string | string[] | null
  folder?: string | string[] | null
  source?: string | string[] | null
  custom?: Record<string, string[]> | null
  date_from?: string | null
  date_to?: string | null
  sort?: string
  alert_enabled?: boolean
  alert_frequency?: string
}

export type AlertNotification = {
  saved_search_id: string
  saved_search_name: string
  new_count: number
  checked_at: string
  seen: boolean
}

export function listSavedSearches(): Promise<SavedSearch[]> {
  return api<SavedSearch[]>('/saved-searches')
}

export function createSavedSearch(body: Record<string, unknown>): Promise<unknown> {
  return api('/saved-searches', { method: 'POST', body: JSON.stringify(body) })
}

/** Renvoie la liste mise à jour, comme l'API le fait déjà. */
export function deleteSavedSearch(id: string): Promise<SavedSearch[]> {
  return api<SavedSearch[]>(`/saved-searches/${id}`, { method: 'DELETE' })
}

export function setAlert(id: string, enabled: boolean, frequency: string): Promise<unknown> {
  return api(`/saved-searches/${id}/alert`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled, frequency }),
  })
}

export function listAlerts(): Promise<AlertNotification[]> {
  return api<AlertNotification[]>('/alerts')
}

export function markAllAlertsSeen(): Promise<unknown> {
  return api('/alerts/mark-all-seen', { method: 'POST' })
}

/**
 * Efface toutes les notifications de l'utilisateur courant.
 *
 * À distinguer de markAllAlertsSeen(), qui ne retire que le badge : ici
 * la liste est vidée. Les recherches enregistrées et leurs alertes ne
 * sont pas touchées — le worker redéposera une notification à la
 * prochaine vérification positive.
 */
export function purgeAlerts(): Promise<unknown> {
  return api('/alerts', { method: 'DELETE' })
}

/**
 * Normalise vers un tableau, en acceptant le format actuel (liste) comme
 * l'ancien (chaîne unique).
 */
export function toArray(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

/**
 * Extensions d'une recherche enregistrée : la chaîne « all » des anciens
 * enregistrements redevient un tableau vide (aucun filtre de type).
 */
export function extList(ext: string | string[] | undefined): string[] {
  if (Array.isArray(ext)) return ext
  return ext && ext !== 'all' ? [ext] : []
}
