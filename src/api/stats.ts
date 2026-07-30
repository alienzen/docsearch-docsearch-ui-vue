import { api } from './client'

// Endpoints de la page de statistiques. Tous sous /admin/* : l'API y
// applique elle-même le contrôle du groupe LDAP admin et répond 401/403
// à un utilisateur non habilité — c'est ce que la page transforme en
// bandeau « Accès refusé ».

/**
 * Avis d'un groupe. `group` vaut `__sans_groupe__` pour les recherches
 * antérieures à la capture des groupes, ou les utilisateurs sans
 * appartenance — un lot explicite plutôt qu'un silence.
 */
export type FeedbackByGroup = {
  group: string
  searches: number
  feedback_up: number
  feedback_down: number
}

export type SearchLogsSummary = {
  total_searches: number
  unique_users: number
  unique_ips: number
  by_day: { date: string; count: number }[]
  feedback_up: number
  feedback_down: number
  by_group: FeedbackByGroup[]
}

export type NpsByGroup = {
  group: string
  responses: number
  detractors: number
  passives: number
  promoters: number
  /** Recalculé sur le périmètre du groupe, jamais déduit du score global. */
  nps_score: number | null
}

export type NpsSummary = {
  total_responses: number
  nps_score: number | null
  detractors: number
  passives: number
  promoters: number
  by_group: NpsByGroup[]
}

/** Libellé du lot sans groupe — voir FeedbackByGroup. */
export const SANS_GROUPE = '__sans_groupe__'

export function groupLabel(group: string): string {
  return group === SANS_GROUPE ? 'Non renseigné' : group
}

export type Suggestion = {
  id: string
  timestamp: string
  text: string
  status?: string
  category?: string
  username?: string | null
}

export type ZeroResultQuery = {
  query: string
  count: number
  last_seen: string
}

export type SearchLogEntry = {
  id: string
  timestamp: string
  username: string
  query: string
  search_in?: string
  total_results?: number
  result_files?: string[]
  ip?: string
  // Peuvent être une liste (sélection cumulative) ou une chaîne unique
  // pour les lignes enregistrées avant ce changement.
  extension?: string | string[]
  author?: string | string[]
  folder?: string | string[]
  source?: string | string[]
  date_from?: string
  date_to?: string
  feedback?: 'up' | 'down'
  clicks?: unknown[]
}

export type AuditLogEntry = {
  id: string
  timestamp: string
  username: string
  method: string
  path: string
  path_params?: Record<string, unknown>
  body?: Record<string, unknown>
  status_code?: number
}

export type Paginated<T> = { total: number; results: T[] }

export function getSummary(): Promise<SearchLogsSummary> {
  return api<SearchLogsSummary>('/admin/search-logs/summary')
}

export function getNpsSummary(): Promise<NpsSummary> {
  return api<NpsSummary>('/admin/nps-summary')
}

export function getSuggestions(size: number, from: number): Promise<Paginated<Suggestion>> {
  return api<Paginated<Suggestion>>(`/admin/suggestions?size=${size}&from=${from}`)
}

export function setSuggestionStatus(id: string, status: string): Promise<unknown> {
  return api(`/admin/suggestions/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export function getZeroResults(): Promise<{
  total_zero_result_searches: number
  results: ZeroResultQuery[]
}> {
  return api('/admin/search-logs/zero-results')
}

export function getSearchLogs(
  size: number,
  from: number,
  q: string,
): Promise<Paginated<SearchLogEntry>> {
  const params = new URLSearchParams({ size: String(size), from: String(from) })
  if (q) params.set('q', q)
  return api<Paginated<SearchLogEntry>>(`/admin/search-logs?${params}`)
}

export function getAuditLog(size: number, from: number): Promise<Paginated<AuditLogEntry>> {
  return api<Paginated<AuditLogEntry>>(`/admin/audit-log?size=${size}&from=${from}`)
}

/**
 * URL d'export XLS des journaux. Reprend le filtre de mot-clé courant
 * mais PAS la pagination : l'export couvre toutes les lignes
 * correspondantes, pas la page affichée.
 */
export function searchLogsExportUrl(q: string): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  return `/admin/search-logs/export?${params}`
}
