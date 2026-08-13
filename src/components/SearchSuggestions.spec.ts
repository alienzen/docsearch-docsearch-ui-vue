import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SearchSuggestions from './SearchSuggestions.vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

// Ce qui se vérifie ici : les moments où l'autocomplétion doit se TAIRE
// (saisie trop courte, syntaxe avancée en cours de frappe, bascule
// désactivée), et ce qu'une suggestion retenue fait réellement à l'état
// de recherche — un auteur devient une puce de filtre, pas du texte
// libre, sans quoi le permalien produit ne décrirait pas la recherche
// affichée.
//
// L'input appartient à DsfrHeader : le composant le retrouve par son
// identifiant et l'annote. Les tests le posent donc eux-mêmes dans le
// document, comme la page le ferait.

const REPONSE = {
  suggestions: [
    { text: 'budget 2025', kind: 'history', count: 2 },
    { text: 'Dupont', kind: 'author', count: 7 },
  ],
}

function stubFetch(body: unknown = REPONSE) {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', mock)
  return mock
}

/** Laisse passer l'anti-rebond (150 ms) puis les promesses en vol. */
async function apresRebond() {
  await new Promise((resolve) => setTimeout(resolve, 220))
  await flushPromises()
}

function monter() {
  document.body.innerHTML = '<input id="recherche" type="search" />'
  return mount(SearchSuggestions, { attachTo: document.body })
}

function barre(): HTMLInputElement {
  return document.getElementById('recherche') as HTMLInputElement
}

describe('SearchSuggestions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useUiConfigStore().config.autocomplete_enabled = true
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('ne demande rien en dessous de deux caractères', async () => {
    const fetchMock = stubFetch()
    monter()
    useSearchStore().query = 'b'
    await apresRebond()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  // La syntaxe avancée est transformée en puces par le parseur au moment
  // de la recherche : deux mécanismes sur la même saisie s'affronteraient.
  it('se tait pendant la saisie d’un opérateur', async () => {
    const fetchMock = stubFetch()
    monter()
    useSearchStore().query = 'auteur:Dup'
    await apresRebond()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ne demande rien tant que l’administration ne l’a pas autorisé', async () => {
    const fetchMock = stubFetch()
    useUiConfigStore().config.autocomplete_enabled = false
    monter()
    useSearchStore().query = 'budget'
    await apresRebond()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('affiche les propositions et annonce la liste à l’input', async () => {
    stubFetch()
    const w = monter()
    useSearchStore().query = 'bud'
    await apresRebond()

    expect(w.findAll('[data-testid="suggestion"]')).toHaveLength(2)
    // L'input appartient à DsfrHeader : sans ces attributs, la liste
    // n'existe que pour la souris.
    expect(barre().getAttribute('role')).toBe('combobox')
    expect(barre().getAttribute('aria-expanded')).toBe('true')
  })

  it('parcourt la liste au clavier et désigne l’option active', async () => {
    stubFetch()
    const w = monter()
    useSearchStore().query = 'bud'
    await apresRebond()

    barre().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await w.vm.$nextTick()

    expect(w.findAll('[data-testid="suggestion"]')[0].classes()).toContain(
      'ds-suggestions__option--actif',
    )
    expect(barre().getAttribute('aria-activedescendant')).toBe('recherche-suggestions-option-0')
  })

  it('applique une recherche passée comme texte libre', async () => {
    const fetchMock = stubFetch()
    const w = monter()
    const store = useSearchStore()
    store.query = 'bud'
    await apresRebond()

    await w.findAll('[data-testid="suggestion"]')[0].trigger('mousedown')
    await flushPromises()

    expect(store.query).toBe('budget 2025')
    // La recherche est bien partie : le premier appel était /suggest.
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('/search')
  })

  // Le point qui compte : un auteur retenu produit le MÊME état qu'une
  // facette cochée, donc le même permalien.
  it('transforme un auteur en puce de filtre, pas en texte', async () => {
    stubFetch()
    const w = monter()
    const store = useSearchStore()
    store.query = 'dup'
    await apresRebond()

    await w.findAll('[data-testid="suggestion"]')[1].trigger('mousedown')
    await flushPromises()

    expect(store.author).toEqual(['Dupont'])
    expect(store.query).toBe('')
  })

  it('se ferme sur Échap', async () => {
    stubFetch()
    const w = monter()
    useSearchStore().query = 'bud'
    await apresRebond()

    barre().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()

    expect(barre().getAttribute('aria-expanded')).toBe('false')
  })

  // 403 (bascule coupée entre-temps) ou 503 (moteur indisponible) sous
  // les doigts de quelqu'un qui tape : la liste reste vide, aucun
  // message d'erreur ne s'ouvre sous la barre de recherche.
  it('reste muet quand l’API refuse ou tombe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ detail: 'Service indisponible' }),
      }),
    )
    const w = monter()
    useSearchStore().query = 'bud'
    await apresRebond()

    expect(w.findAll('[data-testid="suggestion"]')).toHaveLength(0)
    expect(w.text()).toBe('')
  })

  // ── Facettes personnalisées ───────────────────────────────────────
  //
  // Même exigence que pour un auteur — une puce, pas du texte — mais sur
  // une dimension que le code ne connaît pas à la compilation : c'est
  // `field` qui dit laquelle, et rien d'autre ne le dit.

  const FACETTE = {
    suggestions: [{ text: 'Paris', kind: 'custom', field: 'bureau', label: 'Bureau', count: 3 }],
  }

  it('transforme une facette personnalisée en puce sur SON champ', async () => {
    stubFetch(FACETTE)
    const w = monter()
    const store = useSearchStore()
    store.query = 'par'
    await apresRebond()

    await w.findAll('[data-testid="suggestion"]')[0].trigger('mousedown')
    await flushPromises()

    expect(store.custom).toEqual({ bureau: ['Paris'] })
    expect(store.query).toBe('')
    // Et surtout pas ailleurs : une valeur de bureau posée en mot-clé
    // filtrerait sur une dimension qui n'a pas été cliquée.
    expect(store.keywords).toEqual([])
    expect(store.author).toEqual([])
  })

  it('affiche le libellé de la facette, pas un intitulé générique', async () => {
    stubFetch(FACETTE)
    const w = monter()
    useSearchStore().query = 'par'
    await apresRebond()

    expect(w.find('[data-testid="suggestion"]').text()).toContain('Bureau')
  })

  it('retombe sur le libellé connu du store quand l’API n’en donne pas', async () => {
    stubFetch({ suggestions: [{ text: 'Paris', kind: 'custom', field: 'bureau' }] })
    const uiConfig = useUiConfigStore()
    uiConfig.customFacetLabels = { bureau: 'Bureau' }
    const w = monter()
    useSearchStore().query = 'par'
    await apresRebond()

    expect(w.find('[data-testid="suggestion"]').text()).toContain('Bureau')
  })

  // Sans `field`, l'interface saurait qu'il faut cocher une facette mais
  // pas laquelle : mieux vaut ne rien faire que filtrer au hasard.
  it('ignore une facette personnalisée sans champ', async () => {
    const fetchMock = stubFetch({ suggestions: [{ text: 'Paris', kind: 'custom' }] })
    const w = monter()
    const store = useSearchStore()
    store.query = 'par'
    await apresRebond()

    await w.findAll('[data-testid="suggestion"]')[0].trigger('mousedown')
    await flushPromises()

    expect(store.custom).toEqual({})
    expect(store.query).toBe('par')
    // Aucune recherche relancée : le dernier appel reste /suggest.
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('/search/suggest')
  })

  it('cumule deux valeurs de la même facette', async () => {
    stubFetch(FACETTE)
    const w = monter()
    const store = useSearchStore()
    store.custom = { bureau: ['Lyon'] }
    store.query = 'par'
    await apresRebond()

    await w.findAll('[data-testid="suggestion"]')[0].trigger('mousedown')
    await flushPromises()

    expect(store.custom).toEqual({ bureau: ['Lyon', 'Paris'] })
  })
})
