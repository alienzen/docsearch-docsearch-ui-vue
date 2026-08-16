import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

// Préférences d'AFFICHAGE, persistées par navigateur/poste — ce ne sont
// pas des critères de recherche : elles survivent donc à
// resetSearch()/clearAllFilters(), contrairement à tout ce que porte
// useSearchStore. Mêmes clés localStorage que docsearch-ui, pour qu'un
// utilisateur retrouve ses réglages après la bascule vers cette interface.
const COMPACT_RESULTS_KEY = 'docsearch-compact-results'
const FACET_COLLAPSED_KEY = 'docsearch-collapsed-facets'
// Clé DISTINCTE de la précédente : celle-ci replie la colonne entière,
// l'autre mémorise le pli de chaque section. Les mêler ferait qu'un
// identifiant de section et le drapeau global se marcheraient dessus.
const FACETS_HIDDEN_KEY = 'docsearch-facets-hidden'
const FACETS_WIDTH_KEY = 'docsearch-facets-width'
// Même geste que FACETS_HIDDEN_KEY, mais côté administration : escamoter
// la colonne latérale pour laisser toute la largeur au contenu. Clé
// distincte, les deux pages n'ayant aucune raison de se suivre.
const SOMMAIRE_HIDDEN_KEY = 'docsearch-admin-sommaire-hidden'
// Nouvelle clé, sans équivalent dans docsearch-ui : le temps de
// recherche n'y était pas affiché.
const SHOW_SEARCH_TIME_KEY = 'docsearch-show-search-time'

/**
 * Largeur de la colonne de facettes, en pixels. Les bornes ne sont pas
 * décoratives : en deçà, un libellé de facette n'est plus lisible ;
 * au-delà, la colonne mangerait les résultats sur un portable. Elles
 * s'appliquent aussi À LA LECTURE, une valeur stockée pouvant provenir
 * d'un écran bien plus large que celui du jour.
 */
export const FACETS_WIDTH_MIN = 220
export const FACETS_WIDTH_MAX = 520
export const FACETS_WIDTH_DEFAULT = 288

// localStorage peut être indisponible (navigation privée verrouillée,
// stockage désactivé par stratégie de groupe). Toutes les lectures et
// écritures sont donc tolérantes : à défaut de persistance, la
// préférence reste simplement valable pour la session en cours.
function readCompact(): boolean {
  try {
    return localStorage.getItem(COMPACT_RESULTS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Vrai par défaut, contrairement aux autres préférences booléennes de ce
 * fichier : on ne lit cette valeur que si l'administrateur a activé
 * `search_time_enabled`, et une activation qui n'afficherait rien tant
 * que chaque utilisateur n'a pas trouvé le bouton passerait pour une
 * panne. Seul un refus explicite (« 0 » écrit par le bouton) masque
 * l'information.
 */
function readShowSearchTime(): boolean {
  try {
    return localStorage.getItem(SHOW_SEARCH_TIME_KEY) !== '0'
  } catch {
    return true
  }
}

function readFacetsHidden(): boolean {
  try {
    return localStorage.getItem(FACETS_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

function readSommaireHidden(): boolean {
  try {
    return localStorage.getItem(SOMMAIRE_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

function clampFacetsWidth(value: number): number {
  if (!Number.isFinite(value)) return FACETS_WIDTH_DEFAULT
  return Math.min(FACETS_WIDTH_MAX, Math.max(FACETS_WIDTH_MIN, Math.round(value)))
}

function readFacetsWidth(): number {
  try {
    const raw = localStorage.getItem(FACETS_WIDTH_KEY)
    return raw === null ? FACETS_WIDTH_DEFAULT : clampFacetsWidth(Number(raw))
  } catch {
    return FACETS_WIDTH_DEFAULT
  }
}

function readCollapsedFacets(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FACET_COLLAPSED_KEY) || '[]')
  } catch {
    return []
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  /** Liste de résultats en vue compacte (extraits masqués). */
  const resultsCompact = ref(readCompact())

  /**
   * Temps de recherche affiché à côté du décompte de résultats. Sans
   * effet tant que l'administrateur n'a pas activé `search_time_enabled` :
   * les deux se combinent en ET, la bascule d'administration autorisant
   * la fonctionnalité et celle-ci ne réglant que le choix de chacun.
   */
  const showSearchTime = ref(readShowSearchTime())

  /**
   * Identifiants des sections de facettes repliées. Un tableau plutôt
   * qu'un Set : sérialisable tel quel, et réactif sans précaution
   * particulière côté Vue.
   */
  const collapsedFacets = ref<string[]>(readCollapsedFacets())

  /**
   * Colonne de facettes entièrement repliée, pour laisser toute la
   * largeur aux résultats. Distinct de `collapsedFacets`, qui ne joue
   * que sur le pli de chaque section : les deux niveaux se cumulent, et
   * les sections retrouvent leur état à la réouverture de la colonne.
   */
  const facetsHidden = ref(readFacetsHidden())

  /**
   * Sommaire de la page d'administration escamoté. Même geste que
   * `facetsHidden` sur la recherche : le contenu récupère toute la
   * largeur, et la bascule qui le rouvre vit HORS de la colonne (voir
   * AdminPage), faute de quoi elle disparaîtrait avec elle.
   */
  const sommaireHidden = ref(readSommaireHidden())

  /** Largeur de la colonne de facettes, en pixels, toujours bornée. */
  const facetsWidth = ref(readFacetsWidth())

  function setFacetsWidth(value: number) {
    facetsWidth.value = clampFacetsWidth(value)
  }

  function resetFacetsWidth() {
    facetsWidth.value = FACETS_WIDTH_DEFAULT
  }

  function toggleFacetSection(id: string) {
    collapsedFacets.value = collapsedFacets.value.includes(id)
      ? collapsedFacets.value.filter((x) => x !== id)
      : [...collapsedFacets.value, id]
  }

  function isFacetCollapsed(id: string) {
    return collapsedFacets.value.includes(id)
  }

  /**
   * Sections de facettes actuellement À L'ÉCRAN, alimenté par
   * FacetSection à son montage et vidé à son démontage.
   *
   * Délibérément NON persisté, contrairement à tout le reste de ce
   * store : ce n'est pas une préférence mais l'inventaire du moment. Il
   * est indispensable pour « tout replier », `collapsedFacets` ne
   * mémorisant que les sections repliées — sans lui, impossible de savoir
   * ce qu'il reste à replier, d'autant que les facettes SQL
   * personnalisées varient selon les sources interrogées.
   */
  const presentFacets = ref<string[]>([])

  function registerFacet(id: string) {
    if (!presentFacets.value.includes(id)) presentFacets.value = [...presentFacets.value, id]
  }

  function unregisterFacet(id: string) {
    presentFacets.value = presentFacets.value.filter((x) => x !== id)
  }

  /** Vrai seulement s'il y a des sections ET qu'elles sont toutes repliées. */
  const allFacetsCollapsed = computed(
    () =>
      presentFacets.value.length > 0 &&
      presentFacets.value.every((id) => collapsedFacets.value.includes(id)),
  )

  function collapseAllFacets() {
    // Les identifiants déjà mémorisés mais absents de l'écran sont
    // conservés : une facette SQL qui réapparaîtra à la prochaine
    // recherche doit retrouver son pli.
    const merged = new Set([...collapsedFacets.value, ...presentFacets.value])
    collapsedFacets.value = [...merged]
  }

  function expandAllFacets() {
    collapsedFacets.value = collapsedFacets.value.filter((id) => !presentFacets.value.includes(id))
  }

  function toggleAllFacets() {
    if (allFacetsCollapsed.value) expandAllFacets()
    else collapseAllFacets()
  }

  watch(resultsCompact, (value) => {
    try {
      localStorage.setItem(COMPACT_RESULTS_KEY, value ? '1' : '0')
    } catch {
      /* stockage indisponible : préférence valable pour la session */
    }
  })

  watch(showSearchTime, (value) => {
    try {
      localStorage.setItem(SHOW_SEARCH_TIME_KEY, value ? '1' : '0')
    } catch {
      /* idem */
    }
  })

  watch(facetsHidden, (value) => {
    try {
      localStorage.setItem(FACETS_HIDDEN_KEY, value ? '1' : '0')
    } catch {
      /* idem */
    }
  })

  watch(sommaireHidden, (value) => {
    try {
      localStorage.setItem(SOMMAIRE_HIDDEN_KEY, value ? '1' : '0')
    } catch {
      /* idem */
    }
  })

  watch(facetsWidth, (value) => {
    try {
      localStorage.setItem(FACETS_WIDTH_KEY, String(value))
    } catch {
      /* idem */
    }
  })

  watch(collapsedFacets, (value) => {
    try {
      localStorage.setItem(FACET_COLLAPSED_KEY, JSON.stringify(value))
    } catch {
      /* idem */
    }
  })

  return {
    resultsCompact,
    showSearchTime,
    facetsHidden,
    sommaireHidden,
    facetsWidth,
    setFacetsWidth,
    resetFacetsWidth,
    collapsedFacets,
    toggleFacetSection,
    isFacetCollapsed,
    presentFacets,
    registerFacet,
    unregisterFacet,
    allFacetsCollapsed,
    collapseAllFacets,
    expandAllFacets,
    toggleAllFacets,
  }
})
