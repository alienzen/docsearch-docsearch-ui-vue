import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import {
  usePreferencesStore,
  FACETS_WIDTH_DEFAULT,
  FACETS_WIDTH_MAX,
  FACETS_WIDTH_MIN,
} from './preferences'

describe('largeur de la colonne de facettes', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('borne les valeurs écrites', () => {
    const preferences = usePreferencesStore()

    preferences.setFacetsWidth(10)
    expect(preferences.facetsWidth).toBe(FACETS_WIDTH_MIN)

    preferences.setFacetsWidth(9999)
    expect(preferences.facetsWidth).toBe(FACETS_WIDTH_MAX)

    preferences.setFacetsWidth(300)
    expect(preferences.facetsWidth).toBe(300)
  })

  // Le cas qui motive le bornage à la lecture : une largeur enregistrée
  // sur un écran large ne doit pas écraser les résultats sur un portable.
  it('borne aussi la valeur relue du stockage', () => {
    localStorage.setItem('docsearch-facets-width', '4000')
    setActivePinia(createPinia())
    expect(usePreferencesStore().facetsWidth).toBe(FACETS_WIDTH_MAX)
  })

  it('retombe sur la valeur par défaut si le stockage est illisible', () => {
    localStorage.setItem('docsearch-facets-width', 'large')
    setActivePinia(createPinia())
    expect(usePreferencesStore().facetsWidth).toBe(FACETS_WIDTH_DEFAULT)
  })

  it('sépare le pli global du pli des sections', async () => {
    const preferences = usePreferencesStore()
    preferences.facetsHidden = true
    preferences.toggleFacetSection('facet-sources')
    // Les écritures passent par des `watch` : ils ne sont exécutés qu'au
    // cycle suivant, pas à l'affectation.
    await nextTick()

    // Deux clés distinctes : un identifiant de section ne doit jamais
    // pouvoir effacer le drapeau global, ni l'inverse.
    expect(localStorage.getItem('docsearch-facets-hidden')).toBe('1')
    expect(localStorage.getItem('docsearch-collapsed-facets')).toBe('["facet-sources"]')
  })
})
