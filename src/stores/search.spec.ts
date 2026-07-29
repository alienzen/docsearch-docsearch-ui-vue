import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSearchStore } from './search'
import { useUiConfigStore } from './uiConfig'
import type { SearchResponse } from '@/api/types'

// Ces tests portent sur ce que le passage aux stores aurait pu casser
// en silence : la fusion des opérateurs de la barre dans les filtres,
// le caractère cumulatif des facettes, et la différence entre « effacer
// les filtres » et « réinitialiser la recherche ».

const EMPTY_FACETS = {
  extensions: [],
  authors: [],
  keywords: [],
  folders: [],
  sources: [],
  custom: {},
}

function mockSearchResponse(overrides: Partial<SearchResponse> = {}) {
  const body: SearchResponse = {
    total: 0,
    username: 'dev-user',
    search_id: 'sid-1',
    results: [],
    facets: EMPTY_FACETS,
    ...overrides,
  }
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

/** Corps JSON du dernier POST /search intercepté. */
function lastSearchBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return JSON.parse(init.body as string)
}

describe('useSearchStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = mockSearchResponse()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('extrait les opérateurs de la barre et ne garde que le texte libre', async () => {
    const store = useSearchStore()
    store.query = 'type:pdf auteur:"Jean Dupont" rapport'
    await store.doSearch()

    expect(store.ext).toEqual(['.pdf'])
    expect(store.author).toEqual(['Jean Dupont'])
    // La barre ne doit plus contenir les opérateurs : ils sont devenus
    // des puces, seule source de vérité ensuite.
    expect(store.query).toBe('rapport')
    expect(lastSearchBody(fetchMock).query).toBe('rapport')
  })

  it('ne relance pas la recherche quand tous les critères sont vides', async () => {
    const store = useSearchStore()
    store.query = '   '
    await store.doSearch()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cherche avec un filtre seul, sans texte libre', async () => {
    const store = useSearchStore()
    store.query = 'type:pdf'
    await store.doSearch()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(lastSearchBody(fetchMock).query).toBe('')
  })

  it('ne duplique pas un opérateur déjà présent dans les filtres', async () => {
    const store = useSearchStore()
    store.ext = ['.pdf']
    store.query = 'type:pdf rapport'
    await store.doSearch()
    expect(store.ext).toEqual(['.pdf'])
  })

  it('cumule les valeurs d’une facette et revient page 1', async () => {
    const store = useSearchStore()
    store.page = 3
    await store.toggleFacet('author', 'Dupont')
    await store.toggleFacet('author', 'Martin')
    expect(store.author).toEqual(['Dupont', 'Martin'])
    expect(store.page).toBe(1)

    // Un second clic sur la même valeur la retire.
    await store.toggleFacet('author', 'Dupont')
    expect(store.author).toEqual(['Martin'])
  })

  it('retire du store une facette personnalisée devenue vide', async () => {
    const store = useSearchStore()
    await store.toggleCustomFacet('bureau', 'Paris')
    expect(store.custom).toEqual({ bureau: ['Paris'] })
    await store.toggleCustomFacet('bureau', 'Paris')
    // La clé doit disparaître, et pas rester à [] — sinon
    // hasActiveCriteria la compterait comme un filtre actif.
    expect(store.custom).toEqual({})
  })

  it('produit une puce par valeur sélectionnée, retirable individuellement', async () => {
    const store = useSearchStore()
    store.author = ['Dupont', 'Martin']
    store.dateFrom = '2024-01-01'

    expect(store.activeFilters.map((c) => c.label)).toEqual([
      'Auteur : Dupont',
      'Auteur : Martin',
      'Période : 2024-01-01 → …',
    ])

    await store.clearFilter(store.activeFilters[0])
    expect(store.author).toEqual(['Martin'])
  })

  it('nomme les puces de facette personnalisée avec leur libellé', () => {
    const uiConfig = useUiConfigStore()
    uiConfig.customFacetLabels = { bureau: 'Bureau' }
    const store = useSearchStore()
    store.custom = { bureau: ['Paris'] }
    expect(store.activeFilters[0].label).toBe('Bureau : Paris')
  })

  it('clearAllFilters efface les filtres mais garde la requête et le tri', async () => {
    const store = useSearchStore()
    store.query = 'rapport'
    store.sort = 'date_modified'
    store.ext = ['.pdf']
    store.dateFrom = '2024-01-01'

    await store.clearAllFilters()

    expect(store.ext).toEqual([])
    expect(store.dateFrom).toBeNull()
    expect(store.query).toBe('rapport')
    expect(store.sort).toBe('date_modified')
  })

  it('resetSearch ramène à l’état initial, requête et tri compris', async () => {
    const store = useSearchStore()
    store.query = 'rapport'
    store.sort = 'date_modified'
    store.ext = ['.pdf']
    await store.doSearch()
    expect(store.hasSearched).toBe(true)

    store.resetSearch()

    expect(store.query).toBe('')
    expect(store.sort).toBe('_score')
    expect(store.ext).toEqual([])
    expect(store.hasSearched).toBe(false)
    expect(store.results).toEqual([])
  })

  it('expose une erreur lisible quand l’API est injoignable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ detail: 'Service indisponible' }),
      }),
    )
    const store = useSearchStore()
    store.query = 'rapport'
    await store.doSearch()

    expect(store.error).toBe('Service indisponible')
    expect(store.results).toEqual([])
    // hasSearched reste vrai : l'écran doit montrer l'erreur, pas
    // l'invitation initiale « Lancez une recherche ».
    expect(store.hasSearched).toBe(true)
  })

  it('mémorise search_id et les identifiants de résultats', async () => {
    vi.stubGlobal(
      'fetch',
      mockSearchResponse({
        total: 2,
        search_id: 'sid-42',
        results: [
          { id: 'a', score: 1, highlight: [] },
          { id: 'b', score: 0.5, highlight: [] },
        ],
      }),
    )
    const store = useSearchStore()
    store.query = 'rapport'
    await store.doSearch()

    // Rattachent le pouce et le tracking de clic à CETTE recherche.
    expect(store.searchId).toBe('sid-42')
    expect(store.resultIds).toEqual(['a', 'b'])
    expect(store.totalPages).toBe(1)
  })
})
