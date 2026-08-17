import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EmptySearchState from './EmptySearchState.vue'
import { useDialogsStore } from '@/stores/dialogs'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

// Deux sujets ici, et rien de plus : l'effacement des documents
// consultés, et les exemples de recherche. Le reste de l'écran d'accueil
// est décoratif — six variantes tirées au sort — et un test qui figerait
// un tirage aléatoire ne protégerait rien.
//
// Ce qui mérite d'être gardé du premier est le message : l'effacement
// SUPPRIME les consultations du journal de l'installation,
// définitivement, et n'en garde que le nombre (voir history_purge.py).
// Une confirmation qui tait ce qu'elle détruit ne confirme rien.
//
// Les exemples, eux, ne sont plus décoratifs depuis qu'ils viennent de
// l'administration : une liste vidée, une ligne blanche de trop ou une
// configuration qui arrive après le montage sont autant de façons de
// produire un exemple vide — cliquable, et qui lancerait une recherche
// sans texte.

const DOCUMENTS = {
  documents: [
    { id: 'doc-1', filename: 'budget-2025.pdf', title: 'Budget 2025' },
    { id: 'doc-2', filename: 'marche-travaux.pdf', title: 'Marché de travaux' },
  ],
}

function stubFetch(body: unknown = DOCUMENTS) {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', mock)
  return mock
}

async function monterAvecDocuments() {
  const fetchMock = stubFetch()
  useUiConfigStore().config.recent_documents_enabled = true
  const w = mount(EmptySearchState)
  await flushPromises()
  return { w, fetchMock }
}

describe('EmptySearchState — effacement des documents consultés', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('annonce la suppression avant de la demander', async () => {
    const { w } = await monterAvecDocuments()

    await w.find('[data-testid="documents-recents-effacer"]').trigger('click')
    await flushPromises()

    const message = useDialogsStore().pending?.message ?? ''
    expect(message).toContain('supprimées')
    expect(message).toContain('nombre')
    expect(message).toContain('définitif')
  })

  it('efface la liste après confirmation', async () => {
    const { w, fetchMock } = await monterAvecDocuments()

    await w.find('[data-testid="documents-recents-effacer"]').trigger('click')
    await flushPromises()
    useDialogsStore().settle(true)
    await flushPromises()

    const appel = fetchMock.mock.calls.at(-1)
    expect(appel?.[0]).toBe('/me/recent-documents')
    expect((appel?.[1] as RequestInit).method).toBe('DELETE')
    // Le bloc entier disparaît avec la liste : il n'y a plus rien à effacer.
    expect(w.find('[data-testid="documents-recents-effacer"]').exists()).toBe(false)
  })

  it('n’efface rien si la confirmation est refusée', async () => {
    const { w, fetchMock } = await monterAvecDocuments()

    await w.find('[data-testid="documents-recents-effacer"]').trigger('click')
    await flushPromises()
    useDialogsStore().dismiss()
    await flushPromises()

    expect(fetchMock.mock.calls.some((appel) => appel[1]?.method === 'DELETE')).toBe(false)
    expect(w.find('[data-testid="documents-recents-effacer"]').exists()).toBe(true)
  })
})

describe('EmptySearchState — exemples de recherche', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  /**
   * `v-show` et non `v-if` sur chaque exemple : la variante
   * « suggestions » les fait défiler un à un en masquant les autres en
   * CSS. Ils restent donc tous dans le DOM quelle que soit la variante
   * tirée au sort, et ces tests n'ont pas à connaître le tirage.
   */
  function exemples(w: ReturnType<typeof mount>) {
    return w.findAll('[data-testid="exemple-recherche"]').map((n) => n.text())
  }

  function monter(configures: string) {
    stubFetch()
    useUiConfigStore().config.search_examples = configures
    return mount(EmptySearchState)
  }

  it('affiche les exemples réglés dans l’administration', () => {
    const w = monter('bureau:Paris\ntype:xlsx budget')
    expect(exemples(w)).toEqual(['bureau:Paris', 'type:xlsx budget'])
  })

  it('lance la recherche de l’exemple cliqué', async () => {
    const w = monter('bureau:Paris')
    await w.find('[data-testid="exemple-recherche"]').trigger('click')
    expect(useSearchStore().query).toBe('bureau:Paris')
  })

  // Un retour à la ligne en trop dans la zone de saisie est le geste le
  // plus banal du monde ; il ne doit pas produire une étiquette vide,
  // cliquable, qui lancerait une recherche sans texte.
  it('ignore les lignes vides et les espaces de bord', () => {
    const w = monter('\n  bureau:Paris  \n\n\ntype:pdf\n  \n')
    expect(exemples(w)).toEqual(['bureau:Paris', 'type:pdf'])
  })

  it('ne montre aucun bloc quand le réglage est vidé', () => {
    const w = monter('')
    expect(exemples(w)).toEqual([])
    expect(w.find('.ds-empty__examples').exists()).toBe(false)
    // La consigne de saisie prend la place laissée : l'écran d'accueil ne
    // reste pas avec un « Par exemple : » qui n'annonce rien.
    expect(w.text()).toContain('Saisissez des mots-clés')
  })
})
