import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DocumentDetailModal from './DocumentDetailModal.vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import type { SearchResult } from '@/api/types'

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

/**
 * Même illustration que sur la carte, même piège du double affichage —
 * et la fiche rend les mêmes champs par la même fonction, donc l'oubli
 * s'y produirait à l'identique. Elle la montre en grand : c'est le seul
 * écran où l'on regarde un document pour lui-même.
 */
describe('DocumentDetailModal — vignette d’article', () => {
  const ARTICLE = {
    id: 'doc-1',
    title: 'Le budget 2027',
    source: 'rss_presse',
    filepath: 'https://exemple.fr/budget-2027',
    flux: 'Le Quotidien',
    image: 'https://intranet.exemple.fr/img/une.jpg',
  }

  async function fiche(document: Record<string, unknown>) {
    setActivePinia(createPinia())
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

  it('affiche l’image, au format de la fiche', async () => {
    const vignette = (await fiche(ARTICLE)).find('[data-testid="vignette"]')

    expect(vignette.attributes('src')).toBe('https://intranet.exemple.fr/img/une.jpg')
    expect(vignette.classes()).toContain('ds-vignette--detail')
  })

  it('ne montre pas son adresse en clair parmi les champs', async () => {
    const texte = (await fiche(ARTICLE)).text()

    expect(texte).not.toContain('img/une.jpg')
    // Témoin, comme sur la carte : les autres champs de la source sont
    // toujours là.
    expect(texte).toContain('Le Quotidien')
  })
})

/**
 * L'extrait, et l'ordre de ses deux origines : le surlignage de la
 * recherche qui a mené ici d'abord, le début du contenu indexé à défaut.
 *
 * Le surlignage ne peut PAS venir de /document/{id} — sans requête,
 * Elasticsearch n'a rien à surligner — mais du résultat déjà en mémoire.
 * Seule une fiche montée avec un magasin garni le vérifie : bouchonner
 * la réponse de l'API ne dirait rien de cette reprise.
 */
describe('DocumentDetailModal — extrait', () => {
  function resultat(highlight: string[]): SearchResult {
    return { id: 'doc-1', score: 1, highlight }
  }

  async function fiche(
    document: Record<string, unknown>,
    { results = [], pinned = [] }: { results?: SearchResult[]; pinned?: SearchResult[] } = {},
  ) {
    setActivePinia(createPinia())
    const store = useSearchStore()
    store.results = results
    store.pinnedResults = pinned
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

  it('reprend le surlignage du résultat de recherche', async () => {
    const w = await fiche(
      { id: 'doc-1', title: 'Rapport annuel', content: 'Texte intégral du document.' },
      { results: [resultat(['un <mark class="highlight">rapport</mark> annuel'])] },
    )
    const extrait = w.find('#document-extrait')

    expect(extrait.text()).toContain('un rapport annuel')
    expect(extrait.find('mark').text()).toBe('rapport')
    // Le surlignage passe AVANT le contenu : les termes cherchés dans
    // leur phrase valent mieux que le début du document.
    expect(extrait.text()).not.toContain('Texte intégral')
  })

  it('reprend aussi celui d’un document mis en avant', async () => {
    // Un document épinglé est retiré de `results` par l'API pour aller
    // dans `pinned` : le chercher dans la seule liste des résultats
    // laisserait la fiche ouverte depuis un tel document sans extrait.
    const w = await fiche(
      { id: 'doc-1', title: 'Rapport annuel' },
      { pinned: [resultat(['le <mark class="highlight">budget</mark> 2027'])] },
    )

    expect(w.find('#document-extrait').find('mark').text()).toBe('budget')
  })

  it('à défaut, montre le début du contenu, remis d’aplomb', async () => {
    // Sauts de ligne et espaces de mise en page d'un PDF : affichés tels
    // quels, l'extrait se lirait en escalier.
    const w = await fiche({ id: 'doc-1', content: 'Ligne un.\n\n   Ligne  deux.' })

    expect(w.find('#document-extrait').text()).toBe('Ligne un. Ligne deux.')
  })

  it('coupe un contenu long sans trancher de mot', async () => {
    const w = await fiche({ id: 'doc-1', content: Array(120).fill('abcdefgh').join(' ') })
    const texte = w.find('#document-extrait').text()

    expect(texte.endsWith('…')).toBe(true)
    expect(texte.length).toBeLessThanOrEqual(501)
    // Aucun mot amputé : la coupe tombe sur une espace, pas au milieu
    // d'« abcdefgh ».
    const mots = texte.slice(0, -1).trim().split(' ')
    expect(mots.every((mot) => mot === 'abcdefgh')).toBe(true)
  })

  it('n’affiche pas de bloc vide sans surlignage ni contenu', async () => {
    // Le cas d'une ligne de source SQL, qui n'a pas de texte indexé.
    const w = await fiche({ id: 'doc-1', title: 'Dupont Marie', bureau: 'B12' })

    expect(w.find('#document-extrait').exists()).toBe(false)
    // Témoin : la fiche est bien chargée.
    expect(w.text()).toContain('B12')
  })
})
