import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DocumentDetailModal from './DocumentDetailModal.vue'
import { useUiConfigStore } from '@/stores/uiConfig'

/**
 * La fiche détail rend les mêmes champs que la carte de résultat, par la
 * même fonction (extraFields) : ce qui est réservé à l'administration
 * sur l'une doit l'être sur l'autre. Ces tests tiennent l'alignement —
 * c'est le seul endroit où l'oubli du drapeau se verrait, un test de
 * `extraFields` seul ne dirait rien de ses appelants.
 */
const DOCUMENT = {
  id: 'doc-1',
  title: 'Rapport annuel',
  extension: '.pdf',
  source: 'documents',
  content_sha256: 'a1b2c3d4',
}

function stubFetch() {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(DOCUMENT) })
  vi.stubGlobal('fetch', mock)
  return mock
}

async function monter() {
  const w = mount(DocumentDetailModal, {
    props: { documentId: 'doc-1' },
    global: {
      stubs: {
        // Rendu à plat : la fenêtre du DSFR n'intervient pas dans ce qui
        // est vérifié ici, mais son contenu, si.
        DsfrModal: { template: '<div><slot /></div>' },
        DsfrAlert: true,
        DsfrButton: true,
      },
    },
  })
  await flushPromises()
  return w
}

describe('DocumentDetailModal — empreinte de contenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stubFetch()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('ne montre pas l’empreinte à un utilisateur ordinaire', async () => {
    const texte = (await monter()).text()
    // Le témoin : la fiche est bien chargée, ce n'est pas un écran vide
    // qui ferait passer l'assertion suivante pour rien.
    expect(texte).toContain('Rapport annuel')
    expect(texte).not.toContain('Content sha256')
    expect(texte).not.toContain('a1b2c3d4')
  })

  it('la montre à un administrateur', async () => {
    useUiConfigStore().isAdmin = true
    expect((await monter()).text()).toContain('a1b2c3d4')
  })
})
