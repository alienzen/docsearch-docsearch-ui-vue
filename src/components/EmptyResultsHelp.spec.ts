import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EmptyResultsHelp from './EmptyResultsHelp.vue'
import { useSearchStore } from '@/stores/search'
import type { ZeroResult } from '@/api/types'

// Ce qui se vérifie ici : qu'un bouton proposé retire bien le filtre
// qu'il annonce, et qu'aucun bouton n'est proposé pour un filtre que
// cette interface ne saurait pas retirer — un clic sans effet vaut moins
// que pas de bouton.
//
// Les comptes affichés viennent de l'API, qui les a calculés sous l'ACL
// de l'utilisateur : ils ne sont jamais recalculés ici, et ces tests
// n'en inventent donc aucun.

function monter(zero: ZeroResult | null) {
  const store = useSearchStore()
  store.hasSearched = true
  store.zeroResult = zero
  return { w: mount(EmptyResultsHelp, { global: { stubs: { DsfrButton: false } } }), store }
}

const VIDE: ZeroResult = { suggestion: null, relaxations: [], sources: [] }

describe('EmptyResultsHelp', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            total: 0,
            username: 'dev',
            search_id: null,
            results: [],
            facets: { extensions: [], authors: [], keywords: [], folders: [], sources: [], custom: {} },
          }),
      }),
    )
  })

  it('garde le message d’origine quand l’API n’a rien à proposer', () => {
    const { w } = monter(null)
    expect(w.text()).toContain('Aucun résultat ne correspond à ces critères.')
    expect(w.findAll('[data-testid="zero-relachement"]')).toHaveLength(0)
  })

  it('propose de retirer un filtre, et le retire vraiment', async () => {
    const { w, store } = monter({
      ...VIDE,
      relaxations: [{ field: 'extension', count: 12 }],
    })
    store.ext = ['.pdf', '.docx']

    const bouton = w.find('[data-testid="zero-relachement"]')
    expect(bouton.text()).toContain('12 résultats')

    await bouton.trigger('click')
    await flushPromises()

    expect(store.ext).toEqual([])
  })

  it('accorde le singulier', () => {
    const { w } = monter({ ...VIDE, relaxations: [{ field: 'date', count: 1 }] })
    expect(w.find('[data-testid="zero-relachement"]').text()).toBe('Sans la période — 1 résultat')
  })

  it('retire tous les filtres d’un coup', async () => {
    const { w, store } = monter({ ...VIDE, relaxations: [{ field: '__all__', count: 40 }] })
    store.ext = ['.pdf']
    store.author = ['Dupont']
    store.dateFrom = '2024-01-01'

    await w.find('[data-testid="zero-relachement"]').trigger('click')
    await flushPromises()

    expect([store.ext, store.author, store.dateFrom]).toEqual([[], [], null])
  })

  it('retire une facette personnalisée sans toucher aux autres', async () => {
    const { w, store } = monter({ ...VIDE, relaxations: [{ field: 'custom:bureau', count: 3 }] })
    store.custom = { bureau: ['Paris'], fonction: ['Chef'] }

    await w.find('[data-testid="zero-relachement"]').trigger('click')
    await flushPromises()

    expect(store.custom).toEqual({ fonction: ['Chef'] })
  })

  // L'API sait filtrer sur la présence de pièces jointes, mais cette
  // interface ne pose jamais ce filtre : afficher un bouton dont le clic
  // ne changerait rien serait pire que ne rien afficher.
  it('n’affiche pas de bouton pour un filtre qu’il ne sait pas retirer', () => {
    const { w } = monter({ ...VIDE, relaxations: [{ field: 'has_attachments', count: 5 }] })
    expect(w.findAll('[data-testid="zero-relachement"]')).toHaveLength(0)
  })

  it('applique la correction orthographique à la barre de recherche', async () => {
    const { w, store } = monter({ ...VIDE, suggestion: 'rapport' })
    store.query = 'raport'

    await w.find('#zero-correction').trigger('click')
    await flushPromises()

    expect(store.query).toBe('rapport')
  })

  it('bascule vers une autre source', async () => {
    const { w, store } = monter({ ...VIDE, sources: [{ key: 'archives', doc_count: 7 }] })
    store.source = ['documents']

    const bouton = w.find('[data-testid="zero-source"]')
    expect(bouton.text()).toContain('7 résultats')

    await bouton.trigger('click')
    await flushPromises()

    expect(store.source).toEqual(['archives'])
  })
})
