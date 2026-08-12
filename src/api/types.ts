// Types des réponses de docsearch-api. Écrits d'après les modèles
// Pydantic et les `return` de docsearch-api/app/search_api.py — s'y
// reporter en cas de doute, c'est la source de vérité.

/** Un seau d'agrégation Elasticsearch. */
export type FacetBucket = {
  key: string
  doc_count: number
}

/** Facette SQL personnalisée d'une source (ex: « Bureau » pour "agents"). */
export type CustomFacet = {
  label: string
  buckets: FacetBucket[]
}

export type SearchFacets = {
  extensions: FacetBucket[]
  authors: FacetBucket[]
  keywords: FacetBucket[]
  folders: FacetBucket[]
  sources: FacetBucket[]
  /** {champ ES: facette} — varie selon les sources interrogées. */
  custom: Record<string, CustomFacet>
}

/**
 * Un résultat. `id`, `score` et `highlight` sont ajoutés par l'API ; tout
 * le reste vient tel quel du document Elasticsearch (`**h["_source"]`),
 * dont le mapping dépend de la source — d'où l'index de secours.
 */
export type SearchResult = {
  id: string
  score: number
  highlight: string[]
  filename?: string
  title?: string
  extension?: string
  author?: string
  keywords?: string[]
  source?: string
  folder?: string
  filepath?: string
  date_modified?: string
  size?: number
  [key: string]: unknown
}

/**
 * Temps de la recherche, en millisecondes. `took_ms` est celui rapporté
 * par Elasticsearch (le moteur seul), `duration_ms` le temps total du
 * endpoint côté API — leur écart dit si une lenteur vient du moteur ou
 * de ce qui l'entoure. Ni l'un ni l'autre ne comptent l'aller-retour
 * réseau : ce qui s'affiche est donc toujours inférieur à ce que
 * l'utilisateur a attendu.
 */
export type SearchTiming = {
  took_ms: number | null
  duration_ms: number
}

export type SearchResponse = {
  total: number
  username: string
  search_id: string | null
  results: SearchResult[]
  facets: SearchFacets
  /** Optionnel : une API antérieure à la mesure des temps n'en renvoie pas. */
  timing?: SearchTiming
}

/** Champ unique auquel restreindre la recherche (défaut : tout). */
export type SearchIn = 'all' | 'title' | 'author' | 'keywords' | 'filepath'

/**
 * Corps de POST /search et /search/export (modèle SearchQuery).
 * `size`/`from` sont ajoutés par l'appelant : la recherche pagine, pas
 * l'export.
 */
export type SearchCriteria = {
  query: string
  sort: string
  extension: string[] | null
  author: string[]
  keywords: string[]
  folder: string[]
  source: string[]
  custom: Record<string, string[]>
  date_from: string | null
  date_to: string | null
  search_in?: SearchIn
}

export type ExportFormat = 'xlsx' | 'docx'
