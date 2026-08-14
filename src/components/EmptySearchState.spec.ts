import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EmptySearchState from './EmptySearchState.vue'
import { useDialogsStore } from '@/stores/dialogs'
import { useUiConfigStore } from '@/stores/uiConfig'

// Ce fichier ne couvre QUE l'effacement des documents consultés. Le
// reste de l'écran d'accueil est décoratif — six variantes tirées au
// sort, des exemples de syntaxe — et un test qui figerait un tirage
// aléatoire ne protégerait rien.
//
// Ce qui mérite d'être gardé ici est le message : l'effacement SUPPRIME
// les consultations du journal de l'installation, définitivement, et
// n'en garde que le nombre (voir history_purge.py). Une confirmation qui
// tait ce qu'elle détruit ne confirme rien.

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
