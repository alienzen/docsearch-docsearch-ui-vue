import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { useRechercheParDefaut } from './useRechercheParDefaut'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

/**
 * Ce qui compte ici n'est pas qu'une recherche parte — c'est qu'elle ne
 * parte PAS quand quelque chose d'autre a déjà décidé de l'écran : les
 * critères d'un lien partagé, une recherche déjà lancée, une saisie en
 * cours. La configuration arrive après le montage, ce qui laisse
 * justement le temps à ces trois cas de se produire.
 */

/** Le store lance un vrai `doSearch` : on n'observe que l'appel réseau. */
function stubFetch() {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ results: [], total: 0, facets: {} }),
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

function monter() {
  const Hote = defineComponent({
    setup() {
      useRechercheParDefaut()
      return () => h('div')
    },
  })
  return mount(Hote)
}

/** L'URL du visiteur, lue au montage du composable. */
function urlDeLaPage(chaine: string) {
  window.history.replaceState({}, '', chaine)
}

describe('useRechercheParDefaut', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
    urlDeLaPage('/')
  })

  it('joue la recherche de l’administrateur quand l’écran est vierge', async () => {
    stubFetch()
    const uiConfig = useUiConfigStore()
    monter()

    // La configuration arrive après le montage, comme en vrai.
    uiConfig.config.default_search = 'source:RH note de service'
    await flushPromises()

    expect(useSearchStore().hasSearched).toBe(true)
    expect(useSearchStore().source).toEqual(['RH'])
  })

  it('n’écrase pas les critères du visiteur venu par un lien partagé', async () => {
    stubFetch()
    const uiConfig = useUiConfigStore()
    urlDeLaPage('/?q=budget')
    monter()

    uiConfig.config.default_search = 'source:RH'
    await flushPromises()

    // usePermalien n'est pas monté ici : ce que ce test vérifie, c'est
    // que la recherche par défaut S'EFFACE devant l'URL, pas ce que
    // l'autre composable en fait.
    expect(useSearchStore().hasSearched).toBe(false)
    expect(useSearchStore().query).toBe('')
  })

  it('n’écrase pas une saisie faite pendant le chargement de la configuration', async () => {
    stubFetch()
    const uiConfig = useUiConfigStore()
    const store = useSearchStore()
    monter()

    store.query = 'ce que je suis en train de taper'
    uiConfig.config.default_search = 'source:RH'
    await flushPromises()

    expect(store.query).toBe('ce que je suis en train de taper')
    expect(store.hasSearched).toBe(false)
  })

  it('ne fait rien tant que le réglage est vide — le défaut de toute installation', async () => {
    const fetchMock = stubFetch()
    monter()
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSearchStore().hasSearched).toBe(false)
  })

  it('ne rejoue rien si l’administrateur modifie le réglage page ouverte', async () => {
    stubFetch()
    const uiConfig = useUiConfigStore()
    const store = useSearchStore()
    monter()

    uiConfig.config.default_search = 'source:RH'
    await flushPromises()
    store.query = 'ma propre recherche'

    uiConfig.config.default_search = 'source:Finance'
    await flushPromises()

    expect(store.query).toBe('ma propre recherche')
  })
})
