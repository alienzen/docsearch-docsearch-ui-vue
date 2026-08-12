import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistoriquePanel from './HistoriquePanel.vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

// Deux entrées et non une : c'est la règle du dépôt pour les listes
// bouchonnées (voir README, « Identifiants des éléments d'interface ») —
// avec une seule, un identifiant littéral posé dans un v-for ne se
// dédouble jamais et le contrôle passe au vert sans rien vérifier.
const HISTORIQUE = {
  searches: [
    { query: 'budget 2025', count: 2, last: '2026-08-12T09:30:00+00:00' },
    { query: 'marché de travaux', count: 1, last: '2026-08-11T14:00:00+00:00' },
  ],
}

function stubFetch(body: unknown = HISTORIQUE) {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('HistoriquePanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => vi.unstubAllGlobals())

  // La bascule vaut `false` par défaut, y compris en repli si /ui-config
  // n'a pas pu être lu : appeler la route donnerait un 403, affiché
  // comme une erreur alors que rien n'est cassé.
  it('n’appelle pas l’API tant que la bascule est désactivée', async () => {
    const fetchMock = stubFetch()
    const w = mount(HistoriquePanel)
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.find('#recherches-recentes').exists()).toBe(false)
  })

  it('charge et affiche les recherches une fois la bascule activée', async () => {
    const fetchMock = stubFetch()
    useUiConfigStore().config.search_history_enabled = true
    const w = mount(HistoriquePanel)
    await flushPromises()

    expect(fetchMock.mock.calls[0][0]).toContain('/me/searches')
    const entrees = w.findAll('[data-testid="recherche-recente"]')
    expect(entrees).toHaveLength(2)
    expect(entrees[0].text()).toContain('budget 2025')
    // Le nombre d'occurrences n'est affiché qu'au-delà de une.
    expect(entrees[0].text()).toContain('2 fois')
    expect(entrees[1].text()).not.toContain('1 fois')
  })

  it('relance la recherche retenue', async () => {
    const fetchMock = stubFetch()
    useUiConfigStore().config.search_history_enabled = true
    const store = useSearchStore()
    const w = mount(HistoriquePanel)
    await flushPromises()

    await w.find('[data-testid="recherche-recente-relancer"]').trigger('click')
    await flushPromises()

    expect(store.query).toBe('budget 2025')
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('/search')
  })

  // Rien à ouvrir tant que l'utilisateur n'a rien cherché : une entrée de
  // navigation vide n'apprend rien et occupe une place.
  it('n’affiche pas l’entrée quand l’historique est vide', async () => {
    stubFetch({ searches: [] })
    useUiConfigStore().config.search_history_enabled = true
    const w = mount(HistoriquePanel)
    await flushPromises()

    expect(w.find('#recherches-recentes').exists()).toBe(false)
  })
})
