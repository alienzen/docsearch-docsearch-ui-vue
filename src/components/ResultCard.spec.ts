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

describe('les deux dates', () => {
  // `date_created` ne s'affichait nulle part dans la liste — la carte ne
  // rendait que `date_modified`, sous le mot « Modifié ». Sur un article
  // de flux, la publication est pourtant l'information, et la mise à jour
  // l'exception.
  function carte(dates: { date_created?: string; date_modified?: string }) {
    setActivePinia(createPinia())
    return mount(ResultCard, {
      props: {
        result: { id: 'x', title: 'Article', source: 'rss_presse', highlight: [], ...dates } as never,
        selected: false,
      },
      global: { stubs: { DsfrButton: true, CopyPathButtons: true } },
    })
  }

  it('affiche la publication', () => {
    expect(carte({ date_created: '2026-08-18T06:30:00+00:00' }).text()).toContain(
      'Publié : 2026-08-18',
    )
  })

  it('masque « Modifié » quand les deux dates tombent le même jour', () => {
    // Le cas ORDINAIRE d'un flux RSS 2.0 : `pubDate` seul, recopié dans
    // les deux champs par le module. Sans ce masquage, chaque article
    // affichait deux fois la même date, sous deux mots différents.
    const texte = carte({
      date_created: '2026-08-18T06:30:00+00:00',
      date_modified: '2026-08-18T06:30:00+00:00',
    }).text()
    expect(texte).toContain('Publié : 2026-08-18')
    expect(texte).not.toContain('Modifié')
  })

  it('masque « Modifié » même quand les horodatages diffèrent dans la journée', () => {
    // La comparaison porte sur le jour, c'est-à-dire sur ce qui est
    // AFFICHÉ : comparer les horodatages entiers rendrait deux lignes
    // identiques à l'écran.
    const texte = carte({
      date_created: '2026-08-18T06:30:00+00:00',
      date_modified: '2026-08-18T18:05:00+00:00',
    }).text()
    expect(texte).not.toContain('Modifié')
  })

  it('affiche les deux quand la correction est un autre jour', () => {
    // Un Atom portant `published` ET `updated` : les deux dates disent
    // alors deux choses distinctes, et la carte ne montrait que la
    // seconde.
    const texte = carte({
      date_created: '2026-08-18T06:30:00+00:00',
      date_modified: '2026-08-20T09:00:00+00:00',
    }).text()
    expect(texte).toContain('Publié : 2026-08-18')
    expect(texte).toContain('Modifié : 2026-08-20')
  })

  it('garde « Modifié » seul pour un document sans date de publication', () => {
    // Les articles indexés avant que le module renseigne ses dates, et
    // toute source qui ne fournit que la modification.
    const texte = carte({ date_modified: '2026-08-20T09:00:00+00:00' }).text()
    expect(texte).toContain('Modifié : 2026-08-20')
    expect(texte).not.toContain('Publié')
  })

  it('n’affiche aucune ligne de date quand le document n’en porte pas', () => {
    // Une ligne de source SQL : « Publié : — / Modifié : — » au milieu de
    // ses vraies données n'apprend rien.
    const texte = carte({}).text()
    expect(texte).not.toContain('Publié')
    expect(texte).not.toContain('Modifié')
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
      props: {
        result: { id: 'x', filename: 'f', filepath, source, highlight: [] } as never,
        selected: false,
      },
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

describe('lien vers la page d’origine', () => {
  // Sources web et documents de modules rangent une adresse dans
  // `filepath` ; elle s'affichait en texte brut, sans moyen d'ouvrir la
  // page. Une source fichier, elle, n'a rien à ouvrir.
  function carte(filepath: string) {
    setActivePinia(createPinia())
    return mount(ResultCard, {
      props: {
        result: { id: 'x', filename: 'f', filepath, source: 'rss_presse', highlight: [] } as never,
        selected: false,
      },
      global: { stubs: { DsfrButton: true, CopyPathButtons: true } },
    })
  }

  it('rend une ancre quand le chemin est une adresse', () => {
    const lien = carte('https://exemple.fr/article').find('[data-testid="carte-resultat-lien"]')
    expect(lien.exists()).toBe(true)
    expect(lien.attributes('href')).toBe('https://exemple.fr/article')
  })

  it('ouvre dans une nouvelle fenêtre, sans donner la main sur l’ouvreur', () => {
    // `rel=noopener` n'est pas décoratif : sans lui, la page ouverte peut
    // manipuler `window.opener`, et elle vient d'un tiers.
    const lien = carte('https://exemple.fr/article').find('[data-testid="carte-resultat-lien"]')
    expect(lien.attributes('target')).toBe('_blank')
    expect(lien.attributes('rel')).toBe('noopener')
  })

  it('ne rend PAS d’ancre pour un chemin de fichier', () => {
    const w = carte('/sources/finance/budget.pdf')
    expect(w.find('[data-testid="carte-resultat-lien"]').exists()).toBe(false)
    expect(w.text()).toContain('/sources/finance/budget.pdf')
  })

  it("abrège le TEXTE d'une adresse longue, sans toucher à ce qui est ouvert", () => {
    const url =
      'https://www.exemple.gouv.fr/politiques-publiques/transition-ecologique/mobilites/rapport-annuel-2026.pdf'
    const lien = carte(url).find('[data-testid="carte-resultat-lien"]')
    // Ouvert et survolé : l'adresse entière. Affiché : la forme courte,
    // qui garde l'hôte et le nom du document.
    expect(lien.attributes('href')).toBe(url)
    expect(lien.attributes('title')).toContain(url)
    expect(lien.text()).toBe('exemple.gouv.fr/…/rapport-annuel-2026.pdf')
  })

  it('ne rend PAS d’ancre pour un javascript:', () => {
    // Le `filepath` d'un document de module vient d'un tiers — pour le
    // module RSS, du `<link>` écrit par l'éditeur du flux.
    // La règle vise le code qui FABRIQUE de telles URL, pas celui qui
    // vérifie qu'on les refuse — et l'écrire autrement masquerait ce qui
    // est éprouvé.
    // eslint-disable-next-line no-script-url -- valeur éprouvée par ce test
    const w = carte('javascript:alert(1)')
    expect(w.find('[data-testid="carte-resultat-lien"]').exists()).toBe(false)
  })
})
