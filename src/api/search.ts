import { api } from './client'
import type {
  ExportFormat,
  SearchCriteria,
  SearchIn,
  SearchResponse,
} from './types'

// ── Syntaxe avancée de recherche ──────────────────────────────
// "auteur:", "mots-cles:", "type:", "source:", "dossier:" (+ alias
// anglais) dans la barre de recherche — convertis en filtres cumulatifs,
// EXACTEMENT comme un clic sur la facette correspondante : même
// sélection cumulative, mêmes puces retirables, même correspondance
// EXACTE (pas de recherche floue — la valeur doit correspondre à ce
// qu'affiche la facette). Valeur sur un seul mot (auteur:dupont) ou
// entre guillemets pour les espaces (auteur:"Jean Dupont"). Un
// opérateur non reconnu (ex: "foo:bar") est laissé tel quel dans le
// texte libre plutôt que silencieusement supprimé.
//
// Ces opérateurs fixes sont volontairement prioritaires sur les facettes
// SQL personnalisées dynamiques : une source qui déclarerait par mégarde
// un champ "source" ou "type" ne doit jamais pouvoir masquer ces
// dimensions communes à toutes les installations.
/** Dimensions de filtre ciblables par un opérateur fixe (hors `custom`). */
export type FixedDimension = 'author' | 'keywords' | 'ext' | 'source' | 'folder'

export const ADVANCED_QUERY_OPERATORS: Record<string, FixedDimension> = {
  auteur: 'author',
  author: 'author',
  // Pas d'accent dans les clés : ADVANCED_QUERY_RE ne matche que
  // [a-zA-Z0-9_-]+ avant les ":" — "mots-clés:" ne serait jamais reconnu
  // à cause du "é".
  'mots-cles': 'keywords',
  motscles: 'keywords',
  keywords: 'keywords',
  keyword: 'keywords',
  type: 'ext',
  ext: 'ext',
  extension: 'ext',
  source: 'source',
  dossier: 'folder',
  folder: 'folder',
}

// Chiffres et underscore en plus des lettres/tiret (par rapport aux
// seuls opérateurs fixes ci-dessus) : les noms de champ ES des facettes
// SQL personnalisées suivent des conventions de nommage plus larges
// (ex: "num_tel") que les opérateurs fixes d'origine.
const ADVANCED_QUERY_RE = /\b([a-zA-Z0-9_-]+):(?:"([^"]*)"|(\S+))/g

/**
 * Opérateurs qui n'extraient AUCUNE valeur : ils basculent un mode et
 * laissent leur argument dans le texte libre.
 *
 * `exact:"délégation de service"` équivaut donc exactement à cocher la
 * case « Recherche exacte » et à taper `"délégation de service"` dans la
 * barre — même état, mêmes résultats, même permalien. C'est ce qui
 * permet à la case et à l'opérateur d'être deux chemins vers une seule
 * et même chose, plutôt que deux fonctionnalités à tenir synchronisées.
 */
const ADVANCED_QUERY_MODES: Record<string, 'exact'> = {
  exact: 'exact',
  exacte: 'exact',
}

export type ExtractedFilters = {
  author: string[]
  keywords: string[]
  ext: string[]
  source: string[]
  folder: string[]
  custom: Record<string, string[]>
  /** Mode exact demandé par l'opérateur `exact:` (jamais désactivé par lui). */
  exact: boolean
}

export type ParsedQuery = {
  /** Le texte libre, une fois les opérateurs reconnus retirés. */
  remaining: string
  extracted: ExtractedFilters
}

/**
 * Extrait les opérateurs de la barre de recherche.
 *
 * @param text                   contenu brut de la barre
 * @param customFacetOperators   {nom d'opérateur en minuscules: champ ES},
 *                               les facettes SQL personnalisées actives
 */
export function parseAdvancedQuery(
  text: string,
  customFacetOperators: Record<string, string> = {},
): ParsedQuery {
  const extracted: ExtractedFilters = {
    author: [],
    keywords: [],
    ext: [],
    source: [],
    folder: [],
    custom: {},
    exact: false,
  }
  const remaining = text
    .replace(ADVANCED_QUERY_RE, (match, key: string, quoted: string, bare: string) => {
      const lowerKey = key.toLowerCase()
      const dim = ADVANCED_QUERY_OPERATORS[lowerKey]
      const mode = dim ? null : ADVANCED_QUERY_MODES[lowerKey]
      const customField = dim || mode ? null : customFacetOperators[lowerKey]
      if (!dim && !mode && !customField) return match
      let value = (quoted !== undefined ? quoted : bare).trim()
      if (!value) return match
      if (dim === 'ext') value = (value.startsWith('.') ? value : '.' + value).toLowerCase()
      if (mode) {
        extracted.exact = true
        // Seul opérateur dont l'argument RESTE dans le texte libre : ce
        // qu'il désigne est ce qu'on cherche, pas un filtre sur une
        // facette. Les guillemets sont reposés quand la valeur porte une
        // espace, sans quoi `exact:"délégation de service"` deviendrait
        // trois mots indépendants et perdrait l'adjacence que
        // l'utilisateur avait demandée en les écrivant.
        return /\s/.test(value) ? `"${value}"` : value
      }
      if (dim) {
        extracted[dim].push(value)
      } else {
        const field = customField as string
        ;(extracted.custom[field] = extracted.custom[field] || []).push(value)
      }
      return ''
    })
    .replace(/\s+/g, ' ')
    .trim()
  return { remaining, extracted }
}

/**
 * Critères communs à /search et /search/export — la pagination en est
 * exclue : chacun des deux appelants fixe from/size selon son besoin
 * (l'export ramène tous les résultats, pas la page affichée).
 */
export function buildSearchCriteria(
  query: string,
  filters: {
    sort: string
    ext: string[]
    author: string[]
    keywords: string[]
    folder: string[]
    source: string[]
    custom: Record<string, string[]>
    dateFrom: string | null
    dateTo: string | null
    searchIn?: SearchIn
    exact?: boolean
  },
): SearchCriteria {
  return {
    query,
    sort: filters.sort,
    // Seule dimension envoyée à null quand elle est vide (et non []) :
    // comportement repris tel quel de docsearch-ui.
    extension: filters.ext.length ? filters.ext : null,
    author: filters.author,
    keywords: filters.keywords,
    folder: filters.folder,
    source: filters.source,
    custom: filters.custom,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    ...(filters.searchIn ? { search_in: filters.searchIn } : {}),
    // Omis quand il est faux, comme search_in : c'est la valeur par
    // défaut côté API, et une recherche ordinaire n'a pas à traîner un
    // `exact: false` dans chaque corps de requête.
    ...(filters.exact ? { exact: true } : {}),
  }
}

/**
 * Vrai s'il y a quelque chose à chercher : du texte libre, ou au moins
 * un filtre actif (facette cliquée ou extraite de la syntaxe avancée, ou
 * période). Une recherche aux critères tous vides ne part jamais.
 */
export function hasActiveCriteria(criteria: SearchCriteria): boolean {
  return !!(
    criteria.query ||
    criteria.extension?.length ||
    criteria.author.length ||
    criteria.keywords.length ||
    criteria.folder.length ||
    criteria.source.length ||
    criteria.date_from ||
    criteria.date_to ||
    Object.values(criteria.custom).some((values) => values.length)
  )
}

export function search(
  criteria: SearchCriteria,
  page: number,
  perPage: number,
): Promise<SearchResponse> {
  return api<SearchResponse>('/search', {
    method: 'POST',
    body: JSON.stringify({
      ...criteria,
      size: perPage,
      from: (page - 1) * perPage,
    }),
  })
}

/**
 * Export des résultats (XLSX / DOCX).
 *
 * POST et non GET (contrairement à /admin/search-logs/export) : les
 * critères peuvent dépasser la taille raisonnable d'une query string.
 * fetch + blob plutôt que window.open(), qui ne sait faire qu'un GET.
 *
 * Renvoie le fichier et son nom ; c'est à l'appelant de déclencher le
 * téléchargement (voir downloadBlob), pour garder cette couche
 * dépourvue de manipulation du DOM et donc testable.
 */
export async function exportResults(
  criteria: SearchCriteria,
  format: ExportFormat,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch('/search/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...criteria, format }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { detail?: string })
    throw new Error(body.detail || `Erreur ${res.status}`)
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  return {
    blob: await res.blob(),
    filename: match ? match[1] : `resultats.${format}`,
  }
}
