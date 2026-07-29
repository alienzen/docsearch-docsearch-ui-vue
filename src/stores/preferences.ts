import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// Préférences d'AFFICHAGE, persistées par navigateur/poste — ce ne sont
// pas des critères de recherche : elles survivent donc à
// resetSearch()/clearAllFilters(), contrairement à tout ce que porte
// useSearchStore. Mêmes clés localStorage que docsearch-ui, pour qu'un
// utilisateur retrouve ses réglages après la bascule vers cette interface.
const COMPACT_RESULTS_KEY = 'docsearch-compact-results'
const FACET_COLLAPSED_KEY = 'docsearch-collapsed-facets'

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
   * Identifiants des sections de facettes repliées. Un tableau plutôt
   * qu'un Set : sérialisable tel quel, et réactif sans précaution
   * particulière côté Vue.
   */
  const collapsedFacets = ref<string[]>(readCollapsedFacets())

  function toggleFacetSection(id: string) {
    collapsedFacets.value = collapsedFacets.value.includes(id)
      ? collapsedFacets.value.filter((x) => x !== id)
      : [...collapsedFacets.value, id]
  }

  function isFacetCollapsed(id: string) {
    return collapsedFacets.value.includes(id)
  }

  watch(resultsCompact, (value) => {
    try {
      localStorage.setItem(COMPACT_RESULTS_KEY, value ? '1' : '0')
    } catch {
      /* stockage indisponible : préférence valable pour la session */
    }
  })

  watch(collapsedFacets, (value) => {
    try {
      localStorage.setItem(FACET_COLLAPSED_KEY, JSON.stringify(value))
    } catch {
      /* idem */
    }
  })

  return { resultsCompact, collapsedFacets, toggleFacetSection, isFacetCollapsed }
})
