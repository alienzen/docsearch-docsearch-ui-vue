import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ActiveFilters from './ActiveFilters.vue'
import { useSearchStore } from '@/stores/search'

// Ce qui se vérifie ici : que les puces ne décrivent QUE des résultats
// affichés. Une source présélectionnée dans le menu de l'en-tête écrit
// dans le même `store.source` que la facette, sans lancer de recherche —
// une puce affichée à ce moment-là annonce un filtrage qui n'a pas eu
// lieu.

function monter() {
  const store = useSearchStore()
  return { w: mount(ActiveFilters, { global: { stubs: { DsfrButton: false } } }), store }
}

describe('ActiveFilters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Retirer une puce relance la recherche : sans ce doublon, le test
    // du clic partirait sur un appel réseau réel.
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
            facets: {
              extensions: [],
              authors: [],
              keywords: [],
              folders: [],
              sources: [],
              custom: {},
            },
          }),
      }),
    )
  })

  it('ne montre rien tant qu’aucune recherche n’a été lancée', async () => {
    const { w, store } = monter()
    store.source = ['documents']
    await w.vm.$nextTick()

    expect(w.find('#filtres-actifs').exists()).toBe(false)
  })

  it('montre les puces dès la première recherche, avant même sa réponse', async () => {
    const { w, store } = monter()
    store.source = ['documents']
    store.loading = true
    await w.vm.$nextTick()

    expect(w.findAll('[data-testid="filtre-actif"]')).toHaveLength(1)
  })

  it('montre les puces des critères une fois la recherche faite', async () => {
    const { w, store } = monter()
    store.hasSearched = true
    store.source = ['documents']
    store.ext = ['.pdf']
    await w.vm.$nextTick()

    const puces = w.findAll('[data-testid="filtre-actif"]')
    expect(puces.map((p) => p.attributes('data-filtre'))).toEqual([
      'Type : PDF',
      'Source : documents',
    ])
  })

  it('retire le filtre de la puce cliquée, et elle seule', async () => {
    const { w, store } = monter()
    store.hasSearched = true
    store.ext = ['.pdf', '.docx']
    await w.vm.$nextTick()

    await w.find('[data-filtre="Type : PDF"]').trigger('click')

    expect(store.ext).toEqual(['.docx'])
    expect(w.findAll('[data-testid="filtre-actif"]')).toHaveLength(1)
  })
})
