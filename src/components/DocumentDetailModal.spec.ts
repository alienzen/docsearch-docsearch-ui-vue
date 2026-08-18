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

/**
 * Sources web et documents de modules rangent une ADRESSE dans
 * `filepath`. La fiche affichait alors « Dossier — » suivi des boutons de
 * copie, sans jamais permettre d'ouvrir la page.
 */
describe('DocumentDetailModal — lien vers la page d’origine', () => {
  const SOURCES = [
    { name: 'documents', label: 'Documents', type: 'file', collectable: true },
    { name: 'rss_presse', label: 'Presse', type: 'plugin', collectable: true },
  ]

  async function fiche(document: Record<string, unknown>) {
    setActivePinia(createPinia())
    useUiConfigStore().allSources = SOURCES as never
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(document) }),
    )
    const w = mount(DocumentDetailModal, {
      props: { documentId: 'doc-1' },
      global: {
        stubs: {
          DsfrModal: { template: '<div><slot /></div>' },
          DsfrAlert: true,
          DsfrButton: true,
          CopyPathButtons: true,
        },
      },
    })
    await flushPromises()
    return w
  }

  afterEach(() => vi.unstubAllGlobals())

  const ARTICLE = {
    id: 'doc-1', title: 'Le budget 2027', source: 'rss_presse',
    filepath: 'https://exemple.fr/budget-2027',
  }

  it('rend une ancre, et remplace la ligne « Dossier »', async () => {
    const w = await fiche(ARTICLE)
    const lien = w.find('[data-testid="detail-lien"]')

    expect(lien.exists()).toBe(true)
    expect(lien.attributes('href')).toBe('https://exemple.fr/budget-2027')
    expect(w.text()).toContain('Adresse')
    expect(w.text()).not.toContain('Dossier')
  })

  it('ouvre dans une nouvelle fenêtre, sans donner la main sur l’ouvreur', async () => {
    const lien = (await fiche(ARTICLE)).find('[data-testid="detail-lien"]')

    expect(lien.attributes('target')).toBe('_blank')
    expect(lien.attributes('rel')).toBe('noopener')
  })

  it("abrège le TEXTE d'une adresse longue, sans toucher à ce qui est ouvert", async () => {
    const url =
      'https://www.exemple.gouv.fr/politiques-publiques/transition-ecologique/mobilites/rapport-annuel-2026.pdf'
    const lien = (await fiche({ ...ARTICLE, filepath: url })).find('[data-testid="detail-lien"]')

    expect(lien.attributes('href')).toBe(url)
    expect(lien.attributes('title')).toContain(url)
    expect(lien.text()).toBe('exemple.gouv.fr/…/rapport-annuel-2026.pdf')
  })

  it('ne rend PAS d’ancre pour un javascript:', async () => {
    // La règle vise le code qui FABRIQUE de telles URL, pas celui qui
    // vérifie qu'on les refuse — et l'écrire autrement masquerait ce qui
    // est éprouvé.
    // eslint-disable-next-line no-script-url -- valeur éprouvée par ce test
    const w = await fiche({ ...ARTICLE, filepath: 'javascript:alert(1)' })

    expect(w.find('[data-testid="detail-lien"]').exists()).toBe(false)
  })

  it('garde la ligne « Dossier » pour un document fichier', async () => {
    const w = await fiche({
      id: 'doc-1', title: 'Rapport', source: 'documents',
      filepath: '/sources/finance/rapport.pdf', folder: 'finance',
    })

    expect(w.find('[data-testid="detail-lien"]').exists()).toBe(false)
    expect(w.text()).toContain('Dossier')
  })
})

/**
 * L'aperçu convertit un FICHIER. La carte de résultat l'avait appris le
 * 2026-08-16 ; la fiche détail proposait encore le lien sur une page web
 * ou un document de module, où il menait à une erreur de conversion.
 */
describe('DocumentDetailModal — lien d’aperçu', () => {
  const SOURCES = [
    { name: 'documents', label: 'Documents', type: 'file', collectable: true },
    { name: 'rss_presse', label: 'Presse', type: 'plugin', collectable: true },
  ]

  async function fiche(document: Record<string, unknown>) {
    setActivePinia(createPinia())
    useUiConfigStore().allSources = SOURCES as never
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(document) }),
    )
    const w = mount(DocumentDetailModal, {
      props: { documentId: 'doc-1' },
      global: {
        stubs: {
          DsfrModal: { template: '<div><slot /></div>' },
          DsfrAlert: true,
          DsfrButton: true,
          CopyPathButtons: true,
        },
      },
    })
    await flushPromises()
    return w
  }

  afterEach(() => vi.unstubAllGlobals())

  it('est proposé pour un document fichier', async () => {
    const w = await fiche({
      id: 'doc-1', title: 'Rapport', source: 'documents',
      filepath: '/sources/finance/rapport.pdf',
    })

    expect(w.find('a[href="/api/preview/doc-1"]').exists()).toBe(true)
  })

  it('n’est PAS proposé pour un document de module', async () => {
    const w = await fiche({
      id: 'doc-1', title: 'Le budget 2027', source: 'rss_presse',
      filepath: 'https://exemple.fr/budget-2027',
    })

    expect(w.find('a[href="/api/preview/doc-1"]').exists()).toBe(false)
  })
})
