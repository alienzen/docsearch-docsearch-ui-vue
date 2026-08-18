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
  /**
   * Nombre de résultats portant une `date_modified` — un compte, pas des
   * seaux : la facette « Période » n'affiche pas de valeurs, elle a
   * seulement besoin de savoir s'il y a quelque chose à filtrer.
   *
   * Facultatif à dessein : une API antérieure à cette clé ne la renvoie
   * pas, et « je ne sais pas » ne doit pas faire disparaître la section
   * — même repli tolérant que dimensionsAffichables().
   */
  with_date?: number
}

/**
 * Un résultat. `id`, `score` et `highlight` sont ajoutés par l'API ; tout
 * le reste vient tel quel du document Elasticsearch (`**h["_source"]`),
 * dont le mapping dépend de la source — d'où l'index de secours.
 */
export type SearchResult = {
  id: string
  /** `null` sur un résultat épinglé : il n'a pas été classé, il a été désigné. */
  score: number | null
  highlight: string[]
  /** Vrai sur les documents mis en avant par l'administration. */
  pinned?: boolean
  filename?: string
  title?: string
  extension?: string
  author?: string
  keywords?: string[]
  source?: string
  folder?: string
  filepath?: string
  /** Date de publication d'un article poussé par un module, de création
   *  ailleurs. Absente quand la source n'en fournit pas — le cœur retire
   *  les dates nulles plutôt que de les indexer à null. */
  date_created?: string
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
  /**
   * Présent UNIQUEMENT quand la recherche n'a rien donné et qu'il y a
   * quelque chose à proposer — l'API omet la clé dans tous les autres
   * cas (voir _aide_zero_resultat côté search_api.py).
   */
  zero_result?: ZeroResult
  /**
   * Documents mis en avant par l'administration sur cette requête —
   * première page uniquement, et absent s'il n'y en a aucun.
   *
   * Ils sont RETIRÉS de `results` quand ils s'y trouvaient déjà : un
   * document ne s'affiche qu'une fois. `total`, lui, ne bouge pas — il
   * compte des documents trouvés, pas des cartes affichées.
   */
  pinned?: SearchResult[]
}

/**
 * De quoi rattraper une recherche infructueuse : la correction
 * orthographique, ce que donnerait le retrait d'un filtre, et les
 * sources non sélectionnées où il y a quelque chose.
 *
 * ⚠️ Chaque compte annoncé ici est déjà passé par l'ACL de l'utilisateur
 * côté API : cliquer sur une proposition donne bien ce nombre de
 * résultats, jamais une liste vide.
 */
export type ZeroResult = {
  /** Requête corrigée, ou null s'il n'y a rien de crédible à proposer. */
  suggestion: string | null
  /**
   * `field` est le nom interne du filtre à retirer : une dimension de
   * facette (`extension`, `author`, `keywords`, `folder`, `source`),
   * `custom:<champ>`, `date`, `has_attachments`, ou `__all__` pour
   * « tous les filtres ».
   */
  relaxations: { field: string; count: number }[]
  sources: { key: string; doc_count: number }[]
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
  /**
   * Recherche exacte : les mots sont cherchés tels qu'écrits, sans
   * racinisation, sans synonymes et sans tolérance aux fautes — mais aux
   * accents et à la casse près (« Congrès » trouve « CONGRES »).
   *
   * Indépendant des guillemets, qui disent « ces mots dans cet ordre » :
   * les deux se combinent. Omis quand il est faux, comme `search_in`.
   */
  exact?: boolean
}

export type ExportFormat = 'xlsx' | 'docx'
