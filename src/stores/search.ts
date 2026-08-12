import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  buildSearchCriteria,
  exportResults as exportResultsApi,
  hasActiveCriteria,
  parseAdvancedQuery,
  search as searchApi,
  type FixedDimension,
} from '@/api/search'
import type { ExportFormat, SearchFacets, SearchResult, SearchTiming } from '@/api/types'
import { extList, toArray, type SavedSearch } from '@/api/savedSearches'
import { downloadBlob, extLabel } from '@/utils/format'
import { ecrireUrl, type CriteresPermalien, type ModeHistorique } from '@/utils/permalien'
import { PER_PAGE } from '@/constants'
import { useUiConfigStore } from './uiConfig'

// Portage de l'objet `state` de docsearch-ui/public/js/state.js et des
// actions qui le manipulent (facets.js, search.js).
//
// ext/author/keywords/folder/source : sélection CUMULATIVE (plusieurs
// valeurs à la fois). Côté Elasticsearch, ext/author/folder/source sont
// combinées en OU — ces champs ne portent qu'une valeur par document,
// un ET n'y matcherait jamais rien — tandis que keywords, multi-valué,
// est combiné en ET : chaque mot-clé coché restreint le résultat (voir
// _keywords_filter dans docsearch-api/app/search_api.py). `ext` stocke
// les valeurs brutes du champ ES (".pdf", ".docx"), identiques aux clés
// renvoyées par facets.extensions.

/** Une puce de filtre actif, avec de quoi la retirer. */
export type FilterChip = {
  label: string
  clear: () => void
}

function toggleArrayValue(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

export const useSearchStore = defineStore('search', () => {
  const uiConfig = useUiConfigStore()

  // ── Critères ────────────────────────────────────────────────
  /** Contenu de la barre de recherche (texte libre après analyse). */
  const query = ref('')
  const ext = ref<string[]>([])
  const author = ref<string[]>([])
  const keywords = ref<string[]>([])
  const folder = ref<string[]>([])
  const source = ref<string[]>([])
  /** Facettes propres à une source SQL — {champ ES: valeurs}. */
  const custom = ref<Record<string, string[]>>({})
  const dateFrom = ref<string | null>(null)
  const dateTo = ref<string | null>(null)
  const sort = ref('_score')
  const page = ref(1)

  // ── Résultats ───────────────────────────────────────────────
  const results = ref<SearchResult[]>([])
  const facets = ref<SearchFacets | null>(null)
  const total = ref(0)
  /**
   * Rattachent le pouce et le tracking de clic à LA recherche qui a
   * produit les résultats affichés.
   */
  const searchId = ref<string | null>(null)
  const resultIds = ref<string[]>([])
  /**
   * Temps de la recherche affichée, ou null si l'API n'en a pas renvoyé.
   * Vidé dès qu'une recherche échoue : une durée qui survivrait à
   * l'erreur se lirait comme celle du message affiché.
   */
  const timing = ref<SearchTiming | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Faux tant qu'aucune recherche n'a été lancée (état initial). */
  const hasSearched = ref(false)

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PER_PAGE)))

  function currentCriteria() {
    return buildSearchCriteria(query.value, {
      sort: sort.value,
      ext: ext.value,
      author: author.value,
      keywords: keywords.value,
      folder: folder.value,
      source: source.value,
      custom: custom.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
    })
  }

  /**
   * L'état de recherche tel que le permalien le porte — critères
   * canoniques, page comprise, sans rien de l'affichage. Voir
   * utils/permalien.ts pour ce qui n'y figure PAS, et pourquoi.
   */
  function criteresPermalien(): CriteresPermalien {
    return {
      query: query.value,
      ext: ext.value,
      author: author.value,
      keywords: keywords.value,
      folder: folder.value,
      source: source.value,
      custom: custom.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      sort: sort.value,
      page: page.value,
    }
  }

  /**
   * Restaure des critères venus de l'URL, SANS lancer la recherche —
   * l'appelant décide s'il la lance et avec quel effet sur l'historique
   * (au montage, il la lance ; sur un retour arrière aussi, mais sans
   * réécrire l'URL que le navigateur vient de changer).
   */
  function appliquerCriteres(c: CriteresPermalien) {
    query.value = c.query
    ext.value = [...c.ext]
    author.value = [...c.author]
    keywords.value = [...c.keywords]
    folder.value = [...c.folder]
    source.value = [...c.source]
    custom.value = { ...c.custom }
    dateFrom.value = c.dateFrom
    dateTo.value = c.dateTo
    sort.value = c.sort
    page.value = c.page
  }

  /**
   * Une puce PAR valeur sélectionnée (sélection cumulative) : la retirer
   * ne désélectionne que cette valeur-là, pas la facette entière.
   */
  const activeFilters = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = []
    for (const value of ext.value) {
      chips.push({
        label: `Type : ${extLabel(value)}`,
        clear: () => (ext.value = ext.value.filter((v) => v !== value)),
      })
    }
    for (const value of source.value) {
      chips.push({
        label: `Source : ${uiConfig.sourceLabel(value)}`,
        clear: () => (source.value = source.value.filter((v) => v !== value)),
      })
    }
    for (const value of author.value) {
      chips.push({
        label: `Auteur : ${value}`,
        clear: () => (author.value = author.value.filter((v) => v !== value)),
      })
    }
    for (const value of keywords.value) {
      chips.push({
        label: `Mot-clé : ${value}`,
        clear: () => (keywords.value = keywords.value.filter((v) => v !== value)),
      })
    }
    for (const value of folder.value) {
      chips.push({
        label: `Dossier : ${value}`,
        clear: () => (folder.value = folder.value.filter((v) => v !== value)),
      })
    }
    for (const [field, values] of Object.entries(custom.value)) {
      for (const value of values) {
        chips.push({
          label: `${uiConfig.customFacetLabels[field] || field} : ${value}`,
          clear: () => removeCustomValue(field, value),
        })
      }
    }
    if (dateFrom.value || dateTo.value) {
      chips.push({
        label: `Période : ${dateFrom.value || '…'} → ${dateTo.value || '…'}`,
        clear: () => {
          dateFrom.value = null
          dateTo.value = null
        },
      })
    }
    return chips
  })

  function removeCustomValue(field: string, value: string) {
    const remaining = (custom.value[field] || []).filter((v) => v !== value)
    if (remaining.length) custom.value[field] = remaining
    else delete custom.value[field]
  }

  // ── Actions ─────────────────────────────────────────────────

  /**
   * Lance la recherche. Les opérateurs tapés dans la barre
   * (`type:pdf`, `auteur:"Jean Dupont"`) sont d'abord extraits et
   * fusionnés dans les filtres : la barre ne garde ensuite que le texte
   * libre, et ces opérateurs deviennent des puces retirables — seule
   * source de vérité ensuite, pour que les retirer via leur ✕ ne les
   * fasse pas réapparaître au prochain Entrée.
   *
   * `historique` décide de ce que devient l'URL — voir ModeHistorique.
   * Le défaut est `remplacer` : la plupart des appels affinent une
   * recherche déjà à l'écran.
   */
  async function doSearch(historique: ModeHistorique = 'remplacer') {
    const raw = query.value.trim()
    const { remaining, extracted } = parseAdvancedQuery(raw, uiConfig.customFacetOperators)

    const dimensions: Record<FixedDimension, typeof ext> = {
      ext,
      author,
      keywords,
      folder,
      source,
    }
    for (const [dim, values] of Object.entries(extracted) as [
      FixedDimension | 'custom',
      string[] | Record<string, string[]>,
    ][]) {
      if (dim === 'custom') continue
      const target = dimensions[dim]
      for (const value of values as string[]) {
        if (!target.value.includes(value)) target.value = [...target.value, value]
      }
    }
    for (const [field, values] of Object.entries(extracted.custom)) {
      const current = custom.value[field] || []
      custom.value[field] = [...current, ...values.filter((v) => !current.includes(v))]
    }

    query.value = remaining

    const criteria = currentCriteria()
    if (!hasActiveCriteria(criteria)) return

    // Avant l'appel, pas après : l'URL doit décrire ce qui est en train
    // d'être cherché, y compris si la requête échoue — recharger la page
    // rejoue alors la même recherche, ce qui est le geste attendu.
    ecrireUrl(criteresPermalien(), historique)

    loading.value = true
    error.value = null
    try {
      const data = await searchApi(criteria, page.value, PER_PAGE)
      total.value = data.total
      results.value = data.results
      facets.value = data.facets
      searchId.value = data.search_id || null
      resultIds.value = data.results.map((r) => r.id)
      timing.value = data.timing || null
      // Libellés des facettes personnalisées de CETTE recherche : ils
      // alimentent les puces sans redemander le libellé au serveur.
      for (const [field, def] of Object.entries(data.facets.custom || {})) {
        uiConfig.customFacetLabels[field] = def.label || field
      }
      hasSearched.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      results.value = []
      facets.value = null
      total.value = 0
      timing.value = null
      hasSearched.value = true
    } finally {
      loading.value = false
    }
  }

  /**
   * Toute modification de filtre ramène à la première page.
   *
   * `historique` est passé à `empiler` par la barre de recherche et par
   * les exemples de la page d'accueil : soumettre une recherche est une
   * navigation, contrairement au fait de cocher une facette.
   */
  function searchFromFirstPage(historique: ModeHistorique = 'remplacer') {
    page.value = 1
    return doSearch(historique)
  }

  function toggleFacet(type: FixedDimension, value: string) {
    const dimensions = { ext, author, keywords, folder, source }
    dimensions[type].value = toggleArrayValue(dimensions[type].value, value)
    return searchFromFirstPage()
  }

  function toggleCustomFacet(field: string, value: string) {
    const next = toggleArrayValue(custom.value[field] || [], value)
    if (next.length) custom.value[field] = next
    else delete custom.value[field]
    return searchFromFirstPage()
  }

  function applyDateRange(from: string | null, to: string | null) {
    dateFrom.value = from || null
    dateTo.value = to || null
    return searchFromFirstPage()
  }

  /** Changer de page empile : Précédent doit revenir à la page 1. */
  function goToPage(newPage: number) {
    page.value = newPage
    return doSearch('empiler')
  }

  function setSort(value: string) {
    sort.value = value
    return searchFromFirstPage()
  }

  /** Retire une puce et relance — cf. clearFilterAt() en vanilla. */
  function clearFilter(chip: FilterChip) {
    chip.clear()
    return searchFromFirstPage()
  }

  /** Efface facettes et période, mais garde la requête et le tri. */
  function clearAllFilters() {
    ext.value = []
    author.value = []
    keywords.value = []
    folder.value = []
    source.value = []
    custom.value = {}
    dateFrom.value = null
    dateTo.value = null
    return searchFromFirstPage()
  }

  /**
   * Remise à zéro complète : contrairement à clearAllFilters(), efface
   * aussi la requête et le tri, et ramène l'affichage à son état
   * initial (aucune recherche lancée). Ne touche PAS aux préférences
   * d'affichage (vue compacte, facettes repliées), qui vivent dans
   * usePreferencesStore.
   *
   * Vide aussi l'URL de ses critères — une remise à zéro qui laisserait
   * le permalien précédent en place ferait réapparaître la recherche au
   * premier rechargement de page.
   */
  function resetSearch(historique: ModeHistorique = 'remplacer') {
    query.value = ''
    ext.value = []
    author.value = []
    keywords.value = []
    folder.value = []
    source.value = []
    custom.value = {}
    dateFrom.value = null
    dateTo.value = null
    sort.value = '_score'
    page.value = 1
    results.value = []
    facets.value = null
    total.value = 0
    searchId.value = null
    resultIds.value = []
    timing.value = null
    error.value = null
    hasSearched.value = false
    uiConfig.customFacetLabels = {}
    ecrireUrl(criteresPermalien(), historique)
  }

  /** Corps attendu par POST /saved-searches — l'état de l'écran tel quel. */
  function savedSearchPayload(name: string) {
    return {
      name,
      query: query.value,
      ext: ext.value,
      author: author.value,
      keywords: keywords.value,
      folder: folder.value,
      source: source.value,
      custom: custom.value,
      date_from: dateFrom.value,
      date_to: dateTo.value,
      sort: sort.value,
    }
  }

  /**
   * Restaure une recherche enregistrée puis la relance. Les
   * enregistrements antérieurs à la sélection cumulative contiennent des
   * chaînes là où on attend des tableaux — d'où toArray()/extList().
   */
  function applySavedSearch(saved: SavedSearch) {
    query.value = saved.query
    ext.value = extList(saved.ext)
    author.value = toArray(saved.author)
    keywords.value = toArray(saved.keywords)
    folder.value = toArray(saved.folder)
    source.value = toArray(saved.source)
    custom.value = saved.custom || {}
    dateFrom.value = saved.date_from || null
    dateTo.value = saved.date_to || null
    sort.value = saved.sort || '_score'
    page.value = 1
    // Restaurer une recherche enregistrée est une navigation : Précédent
    // doit ramener à ce qui était affiché avant.
    return doSearch('empiler')
  }

  async function exportResults(format: ExportFormat) {
    const criteria = currentCriteria()
    if (!hasActiveCriteria(criteria)) return
    const { blob, filename } = await exportResultsApi(criteria, format)
    downloadBlob(blob, filename)
  }

  return {
    query,
    ext,
    author,
    keywords,
    folder,
    source,
    custom,
    dateFrom,
    dateTo,
    sort,
    page,
    results,
    facets,
    total,
    totalPages,
    searchId,
    resultIds,
    timing,
    loading,
    error,
    hasSearched,
    activeFilters,
    currentCriteria,
    criteresPermalien,
    appliquerCriteres,
    doSearch,
    searchFromFirstPage,
    toggleFacet,
    toggleCustomFacet,
    applyDateRange,
    goToPage,
    setSort,
    clearFilter,
    clearAllFilters,
    resetSearch,
    exportResults,
    savedSearchPayload,
    applySavedSearch,
  }
})
