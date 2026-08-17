import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import StatsSuggestionsPanel from './StatsSuggestionsPanel.vue'
import { useDialogsStore } from '@/stores/dialogs'

// La suppression d'une suggestion est IRRÉVERSIBLE et porte sur une
// donnée qu'on ne peut pas redemander à son auteur (anonyme par
// défaut) : ces tests gardent le garde-fou (confirmation), ce que dit la
// confirmation, et le rechargement qui suit — chacun des trois pouvant
// disparaître sans que rien ne casse à l'écran.

// Deux entrées et non une : règle du dépôt pour les listes bouchonnées
// (voir README, « Identifiants des éléments d'interface »).
const PAGE_1 = {
  total: 22,
  results: [
    {
      id: 's1',
      timestamp: '2026-08-14T09:00:00Z',
      text: 'Ajouter un tri par date',
      category: 'idea',
      status: 'nouveau',
      username: null,
    },
    {
      id: 's2',
      timestamp: '2026-08-15T09:00:00Z',
      text: 'Exporter en CSV',
      category: 'idea',
      status: 'nouveau',
      username: 'bob.user',
    },
  ],
  by_group: [
    { group: 'docsearch-users', count: 1 },
    { group: '__sans_groupe__', count: 1 },
  ],
}

/** Deuxième page réduite à une ligne : le cas « dernière de la page ». */
const PAGE_2 = { ...PAGE_1, results: [PAGE_1.results[0]] }

/**
 * `pages` est consommée dans l'ordre par les GET successifs ; le DELETE
 * ne consomme rien. La dernière page reste servie une fois épuisée.
 */
function stubFetch(pages: unknown[] = [PAGE_1], echecSuppression = false) {
  let i = 0
  const mock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      return Promise.resolve({
        ok: !echecSuppression,
        status: echecSuppression ? 404 : 200,
        json: () =>
          Promise.resolve(echecSuppression ? { detail: 'Suggestion introuvable.' } : { status: 'ok' }),
      })
    }
    const body = pages[Math.min(i++, pages.length - 1)]
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

function monter() {
  return mount(StatsSuggestionsPanel, {
    global: { plugins: [createPinia()], components: { VIcon } },
  })
}

async function cliquerSupprimer(w: ReturnType<typeof monter>, rang = 0) {
  await w.findAll('[data-testid="suggestion-supprimer"]')[rang].trigger('click')
  await flushPromises()
}

describe('StatsSuggestionsPanel — suppression', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  it('pose un bouton de suppression par ligne', async () => {
    stubFetch()
    const w = monter()
    await flushPromises()
    expect(w.findAll('[data-testid="suggestion-supprimer"]')).toHaveLength(2)
  })

  it('supprime puis recharge la liste après confirmation', async () => {
    const fetchMock = stubFetch()
    const w = monter()
    await flushPromises()

    await cliquerSupprimer(w)
    useDialogsStore().settle(true)
    await flushPromises()

    const suppression = fetchMock.mock.calls.find((a) => a[1]?.method === 'DELETE')
    expect(suppression?.[0]).toBe('/admin/suggestions/s1')
    // Rechargement complet, et non retrait de la ligne côté client : le
    // total et le décompte par groupe changent aussi.
    expect(fetchMock.mock.calls.filter((a) => !a[1]?.method).length).toBe(2)
  })

  it('cite le texte supprimé et son caractère définitif', async () => {
    stubFetch()
    const w = monter()
    await flushPromises()

    await cliquerSupprimer(w)

    const message = useDialogsStore().pending?.message ?? ''
    expect(message).toContain('Ajouter un tri par date')
    expect(message).toContain('irréversible')
  })

  it('ne supprime rien si la confirmation est refusée', async () => {
    const fetchMock = stubFetch()
    const w = monter()
    await flushPromises()

    await cliquerSupprimer(w)
    useDialogsStore().dismiss()
    await flushPromises()

    expect(fetchMock.mock.calls.some((a) => a[1]?.method === 'DELETE')).toBe(false)
    expect(w.findAll('[data-testid="suggestion-ligne"]')).toHaveLength(2)
  })

  // Un échec silencieux laisserait croire à une suppression faite : la
  // ligne est toujours là au rechargement suivant, sans explication.
  it('affiche l’erreur quand l’API refuse la suppression', async () => {
    stubFetch([PAGE_1], true)
    const w = monter()
    await flushPromises()

    await cliquerSupprimer(w)
    useDialogsStore().settle(true)
    await flushPromises()

    expect(w.find('#suggestions-erreur-statut').exists()).toBe(true)
    expect(w.text()).toContain('Suggestion introuvable')
  })

  // Supprimer la dernière ligne d'une page laissait un tableau vide sous
  // un total non nul, sans moyen évident de revenir en arrière.
  it('recule d’une page en supprimant la dernière ligne d’une page', async () => {
    const fetchMock = stubFetch([PAGE_1, PAGE_2, PAGE_1])
    const w = monter()
    await flushPromises()

    await w.find('#suggestions-pagination-suivant').trigger('click')
    await flushPromises()
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('from=20')

    await cliquerSupprimer(w)
    useDialogsStore().settle(true)
    await flushPromises()

    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('from=0')
  })
})
