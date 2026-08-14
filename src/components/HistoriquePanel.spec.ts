import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistoriquePanel from './HistoriquePanel.vue'
import { useDialogsStore } from '@/stores/dialogs'
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

  // L'effacement passe par une confirmation (useDialogs) : sans fenêtre
  // montée dans le test, c'est le store qui rend la main, comme le
  // ferait le clic sur « Effacer » de la boîte de dialogue.
  it('efface l’historique après confirmation', async () => {
    const fetchMock = stubFetch()
    useUiConfigStore().config.search_history_enabled = true
    const w = mount(HistoriquePanel)
    await flushPromises()

    await w.find('[data-testid="recherches-recentes-effacer"]').trigger('click')
    await flushPromises()
    useDialogsStore().settle(true)
    await flushPromises()

    const appel = fetchMock.mock.calls.at(-1)
    expect(appel?.[0]).toBe('/me/searches')
    expect((appel?.[1] as RequestInit).method).toBe('DELETE')
    // Plus rien à ouvrir : l'entrée de navigation disparaît avec la liste.
    expect(w.find('#recherches-recentes').exists()).toBe(false)
  })

  // L'effacement ANONYMISE le journal de l'installation : c'est
  // irréversible, et ça emporte les documents récemment consultés
  // (enregistrés dans ces mêmes recherches — voir history_purge.py). Une
  // confirmation qui tait ce qu'elle détruit ne confirme rien : ce test
  // garde le contenu du message, pas seulement sa présence.
  it('annonce l’anonymisation avant de la demander', async () => {
    stubFetch()
    useUiConfigStore().config.search_history_enabled = true
    const w = mount(HistoriquePanel)
    await flushPromises()

    await w.find('[data-testid="recherches-recentes-effacer"]').trigger('click')
    await flushPromises()

    const message = useDialogsStore().pending?.message ?? ''
    expect(message).toContain('anonymes')
    expect(message).toContain('documents')
    expect(message).toContain('définitif')
  })

  it('n’efface rien si la confirmation est refusée', async () => {
    const fetchMock = stubFetch()
    useUiConfigStore().config.search_history_enabled = true
    const w = mount(HistoriquePanel)
    await flushPromises()

    await w.find('[data-testid="recherches-recentes-effacer"]').trigger('click')
    await flushPromises()
    useDialogsStore().dismiss()
    await flushPromises()

    expect(fetchMock.mock.calls.some((appel) => appel[1]?.method === 'DELETE')).toBe(false)
    expect(w.findAll('[data-testid="recherche-recente"]')).toHaveLength(2)
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

  // Le cas de la toute première recherche : l'API a bien journalisé, mais
  // Elasticsearch ne rend le document interrogeable qu'à son prochain
  // rafraîchissement. Recharger la liste ici ne servirait à rien —
  // l'entrée n'apparaissait qu'au rechargement de la page.
  it('affiche l’entrée dès la première recherche, sans recharger la page', async () => {
    stubFetch({ searches: [] })
    useUiConfigStore().config.search_history_enabled = true
    const store = useSearchStore()
    const w = mount(HistoriquePanel)
    await flushPromises()
    expect(w.find('#recherches-recentes').exists()).toBe(false)

    store.query = 'budget 2025'
    // Renseigné par l'API seulement quand l'écriture du journal a réussi.
    store.searchId = 'abc123'
    await flushPromises()

    expect(w.find('#recherches-recentes').exists()).toBe(true)
    const entrees = w.findAll('[data-testid="recherche-recente"]')
    expect(entrees).toHaveLength(1)
    expect(entrees[0].text()).toContain('budget 2025')
  })

  // Journal non écrit (moteur en lecture seule, par exemple) : l'API ne
  // renvoie pas de search_id, et la recherche ne sera pas dans
  // l'historique. L'annoncer serait un mensonge d'écran.
  it('n’affiche rien quand la recherche n’a pas été journalisée', async () => {
    stubFetch({ searches: [] })
    useUiConfigStore().config.search_history_enabled = true
    const store = useSearchStore()
    const w = mount(HistoriquePanel)
    await flushPromises()

    store.query = 'budget 2025'
    store.searchId = null
    await flushPromises()

    expect(w.find('#recherches-recentes').exists()).toBe(false)
  })

  it('ne montre pas deux fois la recherche que l’API finit par rendre', async () => {
    const fetchMock = stubFetch({ searches: [] })
    useUiConfigStore().config.search_history_enabled = true
    const store = useSearchStore()
    const w = mount(HistoriquePanel)
    await flushPromises()

    store.query = 'budget 2025'
    store.searchId = 'abc123'
    await flushPromises()

    // Le moteur a rafraîchi : le chargement suivant — ouverture du menu —
    // rend la recherche, avec cette fois sa date et son décompte.
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          searches: [{ query: 'budget 2025', count: 2, last: '2026-08-14T09:30:00+00:00' }],
        }),
    })
    await (w.vm as unknown as { reload: () => Promise<void> }).reload()
    await flushPromises()

    const entrees = w.findAll('[data-testid="recherche-recente"]')
    expect(entrees).toHaveLength(1)
    expect(entrees[0].text()).toContain('2 fois')
  })
})
