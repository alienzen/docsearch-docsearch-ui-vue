import { api } from './client'

// Endpoints de la page de statistiques. Tous sous /admin/* : l'API y
// applique elle-même le contrôle du groupe LDAP admin et répond 401/403
// à un utilisateur non habilité — c'est ce que la page transforme en
// bandeau « Accès refusé ».

/** Un décompte par groupe, partagé par plusieurs panneaux. */
export type CountByGroup = { group: string; count: number }

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

/**
 * Temps de recherche agrégés. `measured` est le nombre de recherches
 * portant effectivement une mesure : il est TOUJOURS à afficher à côté
 * des moyennes, car les recherches enregistrées avant l'introduction de
 * la mesure n'ont pas le champ et sont ignorées par les agrégations —
 * une moyenne calculée sur douze lignes ne dit rien d'un historique qui
 * en compte quatre cent mille. `null` quand rien n'a encore été mesuré.
 */
export type TimingSummary = {
  avg_ms: number | null
  p50_ms: number | null
  p95_ms: number | null
  took_avg_ms: number | null
  slow_count: number
  slow_threshold_ms: number
  measured: number
}

export type SearchLogsSummary = {
  /**
   * Recherches VÉRITABLES : les tours de page en sont écartés (voir
   * `page` dans SearchLogEntry). Les lignes antérieures à la capture du
   * numéro de page y restent comptées, faute de savoir ce qu'elles
   * étaient.
   */
  total_searches: number
  /**
   * Lignes du journal, tours de page compris. Sert la mention d'assiette
   * des temps : `timing.measured` compte des lignes, pas des recherches,
   * et les rapporter à `total_searches` comparerait deux ensembles
   * différents.
   */
  total_logged: number
  unique_users: number
  unique_ips: number
  by_day: { date: string; count: number }[]
  feedback_up: number
  feedback_down: number
  by_group: FeedbackByGroup[]
  /**
   * Volume de recherches par groupe. Distinct de `by_group`, qui ne
   * retient que les groupes ayant donné un avis : un groupe qui cherche
   * sans jamais se prononcer a sa place ici.
   */
  searches_by_group: CountByGroup[]
  timing: TimingSummary
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

/**
 * Un filtre rencontré avec une requête infructueuse. `champ` est le nom
 * du champ du journal (extension, author, folder, keywords, source,
 * search_in) ou `periode` — ce dernier sans valeur, seule sa PRÉSENCE
 * compte (voir _zero_result_criteria côté API).
 */
export type ZeroResultCritere = {
  champ: string
  valeur: string
  count: number
}

export type ZeroResultQuery = {
  query: string
  count: number
  last_seen: string
  /**
   * Filtres rencontrés avec cette requête, le plus fréquent d'abord.
   * ⚠️ Les comptes ne s'additionnent pas jusqu'à `count` : une recherche
   * portant deux filtres compte dans les deux, et une recherche sans
   * filtre ne compte que dans `sans_critere`.
   */
  criteres: ZeroResultCritere[]
  /** Occurrences lancées SANS aucun filtre — voir `criteres`. */
  sans_critere: number
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
  /**
   * Clics dont l'utilisateur a effacé le détail : le document ouvert et
   * la date ont été supprimés du journal, leur nombre est reporté ici
   * (voir `history_purge.py`). Absent tant que personne n'a rien effacé.
   * `clicks.length` seul sous-compterait donc les consultations.
   */
  clicks_erased?: number
  // Absents des recherches antérieures à la mesure des temps.
  duration_ms?: number
  took_ms?: number
  /**
   * Numéro de page, 1 pour une recherche véritable et 2+ pour un tour de
   * page (chaque clic sur « Suivant » relance /search et écrit une ligne
   * de plus). ABSENT — et non 1 — pour les lignes antérieures à ce
   * champ : on ne sait pas ce qu'elles étaient.
   */
  page?: number
  /**
   * Recherche exacte (sans racinisation, synonymes ni tolérance aux
   * fautes). Absent, là encore, ne veut pas dire `false` mais inconnu.
   */
  exact?: boolean
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

/**
 * `by_group` porte sur TOUT l'index, pas sur la page demandée : le
 * décompte ne doit pas changer en tournant les pages.
 */
export function getSuggestions(
  size: number,
  from: number,
): Promise<Paginated<Suggestion> & { by_group: CountByGroup[] }> {
  return api(`/admin/suggestions?size=${size}&from=${from}`)
}

export function setSuggestionStatus(id: string, status: string): Promise<unknown> {
  return api(`/admin/suggestions/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

/**
 * Suppression DÉFINITIVE — pas un statut de plus : « Traité » sert au
 * suivi, ceci sert à faire disparaître un doublon, un dépôt accidentel
 * ou un texte nominatif qu'on ne veut pas conserver. L'API en garde une
 * trace dans le journal d'audit (qui, quand), jamais le texte effacé.
 */
export function deleteSuggestion(id: string): Promise<unknown> {
  return api(`/admin/suggestions/${id}`, { method: 'DELETE' })
}

export function getZeroResults(): Promise<{
  total_zero_result_searches: number
  results: ZeroResultQuery[]
  by_group: CountByGroup[]
}> {
  return api('/admin/search-logs/zero-results')
}

export function getSearchLogs(
  size: number,
  from: number,
  q: string,
  sansNavigation = false,
): Promise<Paginated<SearchLogEntry>> {
  const params = new URLSearchParams({ size: String(size), from: String(from) })
  if (q) params.set('q', q)
  if (sansNavigation) params.set('exclude_pagination', 'true')
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
export function searchLogsExportUrl(q: string, sansNavigation = false): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  // Le filtre « recherches véritables », lui, EST repris : un export qui
  // contiendrait les tours de page que l'écran masque ne serait pas
  // l'export de ce qu'on regarde.
  if (sansNavigation) params.set('exclude_pagination', 'true')
  return `/admin/search-logs/export?${params}`
}
