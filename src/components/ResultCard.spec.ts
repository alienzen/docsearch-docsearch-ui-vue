import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultCard from './ResultCard.vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import { VIcon } from '@gouvminint/vue-dsfr'

/**
 * Deux éléments de la carte que l'installation ne montre pas à tout le
 * monde : l'empreinte de contenu, réservée aux administrateurs, et le
 * pourcentage de pertinence, commandé depuis l'administration.
 *
 * `content_sha256` n'est pas un champ inventé pour le test : l'ingestion
 * le pose sur chaque document fichier, et il ressortait donc sur la carte
 * parmi les champs apportés par la source (voir extraFields).
 */
const RESULTAT = {
  id: 'doc-1',
  title: 'Rapport annuel',
  extension: 'pdf',
  source: 'documents',
  score: 4,
  content_sha256: 'a1b2c3d4',
}

function monter() {
  return mount(ResultCard, {
    props: { result: RESULTAT as never, selected: false },
    global: {
      // Les deux tirent le DSFR et ne concernent en rien ce qui est
      // vérifié ici.
      stubs: { DsfrButton: true, CopyPathButtons: true },
    },
  })
}

describe('ResultCard — empreinte de contenu', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('ne montre pas l’empreinte à un utilisateur ordinaire', () => {
    expect(monter().text()).not.toContain('Content sha256')
  })

  it('la montre à un administrateur', () => {
    useUiConfigStore().isAdmin = true
    const texte = monter().text()
    expect(texte).toContain('Content sha256')
    expect(texte).toContain('a1b2c3d4')
  })
})

describe('ResultCard — pourcentage de pertinence', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('affiche le score tant que la bascule est active', () => {
    // Explicite depuis que le repli du store vaut false : le test porte
    // sur la bascule active, pas sur la valeur par défaut.
    useUiConfigStore().config.score_enabled = true
    expect(monter().find('[data-testid="carte-resultat-score"]').text()).toBe('80 %')
  })

  it('le masque quand l’administration l’a désactivé', () => {
    useUiConfigStore().config.score_enabled = false
    expect(monter().find('[data-testid="carte-resultat-score"]').exists()).toBe(false)
  })

  it('ne le masque que lui — la carte reste entière', () => {
    useUiConfigStore().config.score_enabled = false
    expect(monter().text()).toContain('Rapport annuel')
  })
})

describe('lien d’aperçu', () => {
  // L'aperçu convertit un fichier : ne l'offrir que quand il y en a un.
  // Le test est arrivé APRÈS le défaut — « :: » dans le chemin masquait
  // le lien par accident sur les documents de module, et le corriger l'a
  // fait apparaître, menant à une erreur de conversion.
  function carte(source: string, filepath: string, sources: unknown[]) {
    const pinia = createPinia()
    setActivePinia(pinia)
    const uiConfig = useUiConfigStore()
    uiConfig.allSources = sources as never
    return mount(ResultCard, {
      props: { result: { id: 'x', filename: 'f', filepath, source, highlight: [] } as never },
      global: { plugins: [pinia], components: { VIcon } },
    })
  }

  const SOURCES = [
    { name: 'documents', label: 'Documents', type: 'file', collectable: true },
    { name: 'annuaire', label: 'Annuaire', type: 'plugin', collectable: true },
    { name: 'cc', label: 'CC', type: 'web', collectable: true },
  ]

  it('est proposé pour une source fichier', () => {
    const w = carte('documents', '/sources/a.pdf', SOURCES)
    expect(w.find('[data-testid="carte-resultat-apercu"]').exists()).toBe(true)
  })

  it('n’est PAS proposé pour un document de module', () => {
    const w = carte('annuaire', 'plugin:annuaire/A-1004', SOURCES)
    expect(w.find('[data-testid="carte-resultat-apercu"]').exists()).toBe(false)
  })

  it('n’est PAS proposé pour une page web', () => {
    const w = carte('cc', 'https://exemple.gouv.fr/page', SOURCES)
    expect(w.find('[data-testid="carte-resultat-apercu"]').exists()).toBe(false)
  })

  it('n’est PAS proposé pour un membre d’archive', () => {
    const w = carte('documents', '/sources/a.zip::interne.pdf', SOURCES)
    expect(w.find('[data-testid="carte-resultat-apercu"]').exists()).toBe(false)
  })
})
