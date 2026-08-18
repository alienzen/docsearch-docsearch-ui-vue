import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSearchStore } from './search'
import { useSelectionStore } from './selection'
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
    timing: { took_ms: 4, duration_ms: 12.5 },
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

  // ── Recherche exacte ──────────────────────────────────────────
  //
  // Deux chemins vers un seul critère : la case à cocher et l'opérateur.
  // Ce qui compte est qu'ils aboutissent au même corps de requête.

  it('coche le mode exact depuis l’opérateur et garde le terme cherché', async () => {
    const store = useSearchStore()
    store.query = 'exact:"délégation de service"'
    await store.doSearch()

    expect(store.exact).toBe(true)
    // Contrairement aux autres opérateurs, l'argument RESTE dans la barre :
    // c'est ce qu'on cherche, pas un filtre.
    expect(store.query).toBe('"délégation de service"')
    expect(lastSearchBody(fetchMock).exact).toBe(true)
  })

  it('ne décoche jamais le mode exact au deuxième Entrée', async () => {
    // L'opérateur est consommé dès la première recherche. Si son absence
    // valait « décoché », une recherche lancée à l'opérateur redeviendrait
    // ordinaire au coup suivant, sans que rien ne l'annonce.
    const store = useSearchStore()
    store.query = 'exact:congres'
    await store.doSearch()
    await store.doSearch()

    expect(store.exact).toBe(true)
    expect(lastSearchBody(fetchMock).exact).toBe(true)
  })

  it('n’envoie pas exact pour une recherche ordinaire', async () => {
    const store = useSearchStore()
    store.query = 'rapport'
    await store.doSearch()

    expect(store.exact).toBe(false)
    expect('exact' in lastSearchBody(fetchMock)).toBe(false)
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
    // Retour à « rien choisi », pas à « pertinence choisie » : une
    // remise à zéro ne doit pas laisser derrière elle un choix que
    // l'utilisateur n'a pas fait.
    expect(store.sort).toBeNull()
    expect(store.triApplique).toBe('_score')
    expect(store.ext).toEqual([])
    expect(store.hasSearched).toBe(false)
    expect(store.results).toEqual([])
    expect(store.timing).toBeNull()
  })

  // La barre « X documents sélectionnés » n'a aucun sens dès que les
  // résultats cochés quittent l'écran : elle restait affichée après une
  // réinitialisation, ou après une relance depuis « Mes recherches
  // récentes », qui ne change pourtant pas de numéro de page.
  it('vide la sélection dès que les résultats affichés sont remplacés', async () => {
    const store = useSearchStore()
    const selection = useSelectionStore()

    store.query = 'rapport'
    await store.doSearch()
    selection.set('doc-1', true)
    store.resetSearch()
    expect(selection.count).toBe(0)

    store.query = 'note'
    selection.set('doc-2', true)
    await store.doSearch()
    expect(selection.count).toBe(0)
  })

  // Une recherche sans critère ne part pas : rien ne change à l'écran,
  // donc les cases cochées restent cochées.
  it('garde la sélection quand la recherche n’est pas lancée', async () => {
    const store = useSearchStore()
    const selection = useSelectionStore()
    selection.set('doc-1', true)

    await store.doSearch()

    expect(selection.count).toBe(1)
  })

  it('retient le temps de la recherche affichée', async () => {
    const store = useSearchStore()
    store.query = 'rapport'
    await store.doSearch()

    expect(store.timing).toEqual({ took_ms: 4, duration_ms: 12.5 })
  })

  // Une API antérieure à la mesure ne renvoie pas de `timing` : l'écran
  // doit s'en passer, pas afficher « NaN ms ».
  it('se passe du temps quand l’API n’en renvoie pas', async () => {
    vi.stubGlobal('fetch', mockSearchResponse({ timing: undefined }))
    const store = useSearchStore()
    store.query = 'rapport'
    await store.doSearch()

    expect(store.timing).toBeNull()
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
    // Une durée qui survivrait à l'échec se lirait comme celle du
    // message d'erreur affiché.
    expect(store.timing).toBeNull()
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

  // La position envoyée au suivi de clic est l'index dans cette liste :
  // elle doit décrire l'écran, où les épinglés passent DEVANT les
  // résultats naturels. Les en exclure donnait -1 à tout clic sur un
  // document mis en avant — un rang qui n'existe pas.
  it('place les épinglés en tête des identifiants de résultats', async () => {
    vi.stubGlobal(
      'fetch',
      mockSearchResponse({
        total: 2,
        results: [
          { id: 'a', score: 1, highlight: [] },
          { id: 'b', score: 0.5, highlight: [] },
        ],
        pinned: [{ id: 'epingle', score: null, highlight: [] }],
      }),
    )
    const store = useSearchStore()
    store.query = 'congés'
    await store.doSearch()

    expect(store.resultIds).toEqual(['epingle', 'a', 'b'])
  })

  // ── Permaliens ────────────────────────────────────────────
  //
  // L'aller-retour de sérialisation est couvert par
  // utils/permalien.spec.ts. Ce qui se vérifie ici est l'autre moitié :
  // que le store écrit bien l'URL au bon moment, et avec le bon effet
  // sur l'historique du navigateur.
  describe('permalien', () => {
    beforeEach(() => {
      window.history.replaceState(null, '', '/')
    })

    it('écrit les critères dans l’URL à chaque recherche', async () => {
      const store = useSearchStore()
      store.query = 'budget'
      store.ext = ['.pdf']
      await store.doSearch()

      expect(window.location.search).toBe('?q=budget&type=.pdf')
    })

    // Le cœur du choix de conception : l'URL porte l'état APRÈS
    // extraction des opérateurs, donc la même que si l'utilisateur avait
    // coché la facette.
    it('écrit les critères canoniques, pas le texte tapé', async () => {
      const store = useSearchStore()
      store.query = 'type:pdf rapport'
      await store.doSearch()

      expect(window.location.search).toBe('?q=rapport&type=.pdf')
    })

    it('n’écrit rien quand la recherche ne part pas', async () => {
      const store = useSearchStore()
      store.query = '   '
      await store.doSearch()
      expect(window.location.search).toBe('')
    })

    it('empile une entrée pour une soumission et pour un changement de page', async () => {
      const store = useSearchStore()
      store.query = 'budget'

      const avant = window.history.length
      await store.searchFromFirstPage('empiler')
      await store.goToPage(2)

      expect(window.location.search).toBe('?q=budget&page=2')
      expect(window.history.length).toBe(avant + 2)
    })

    // Cocher une facette affine une recherche déjà à l'écran : empiler
    // obligerait à cliquer quinze fois sur Précédent pour en sortir.
    it('n’empile pas quand on affine', async () => {
      const store = useSearchStore()
      store.query = 'budget'
      await store.doSearch()

      const avant = window.history.length
      await store.toggleFacet('author', 'Dupont')
      await store.setSort('date_modified')

      expect(window.location.search).toBe('?q=budget&auteur=Dupont&tri=date_modified')
      expect(window.history.length).toBe(avant)
    })

    it('vide l’URL à la réinitialisation', async () => {
      const store = useSearchStore()
      store.query = 'budget'
      await store.doSearch()
      store.resetSearch()

      expect(window.location.search).toBe('')
    })

    // Le mode `aucun` sert au retour arrière : le navigateur a déjà
    // changé l'URL, la réécrire empilerait une entrée par retour.
    it('laisse l’URL intacte en mode aucun', async () => {
      const store = useSearchStore()
      window.history.replaceState(null, '', '/?q=budget')
      store.appliquerCriteres({
        query: 'budget',
        ext: [],
        author: [],
        keywords: [],
        folder: [],
        source: [],
        custom: {},
        dateFrom: null,
        dateTo: null,
        sort: '_score',
        page: 1,
        exact: false,
      })
      store.query = 'autre chose'
      await store.doSearch('aucun')

      expect(window.location.search).toBe('?q=budget')
    })

    it('restaure des critères venus de l’URL sans chercher', () => {
      const store = useSearchStore()
      store.appliquerCriteres({
        query: 'budget',
        ext: ['.pdf'],
        author: ['Dupont'],
        keywords: [],
        folder: [],
        source: [],
        custom: { bureau: ['Paris'] },
        dateFrom: '2025-01-01',
        dateTo: null,
        sort: 'date_modified',
        page: 4,
        exact: false,
      })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(store.ext).toEqual(['.pdf'])
      expect(store.custom).toEqual({ bureau: ['Paris'] })
      expect(store.page).toBe(4)
      expect(store.criteresPermalien().sort).toBe('date_modified')
    })
  })
})
