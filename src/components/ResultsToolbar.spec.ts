import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultsToolbar from './ResultsToolbar.vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiConfigStore } from '@/stores/uiConfig'
import { SORT_OPTIONS } from '@/constants'

// Ces tests portent sur la seule vraie logique de l'affichage du temps de
// recherche : sa double condition. La bascule d'administration AUTORISE
// la fonctionnalité pour toute l'installation, la préférence locale
// décide de l'afficher ou non — et le bouton qui règle cette préférence
// ne doit exister que là où il sert à quelque chose.

function monter() {
  return mount(ResultsToolbar, {
    global: {
      stubs: { DsfrSelect: true, DsfrButton: true, DsfrAlert: true },
    },
  })
}

/** Une recherche aboutie, avec sa mesure. */
function rechercheFaite(timing: { took_ms: number | null; duration_ms: number } | null = {
  took_ms: 43,
  duration_ms: 187.7,
}) {
  const store = useSearchStore()
  store.hasSearched = true
  store.total = 12
  store.timing = timing
  return store
}

describe('ResultsToolbar — temps de recherche', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('n’affiche rien tant que l’administration ne l’a pas autorisé', () => {
    rechercheFaite()
    // Défaut de l'installation : la bascule est à false.
    const w = monter()

    expect(w.find('#resultats-duree').exists()).toBe(false)
    // Pas de bouton non plus : proposer de masquer ce qui n'est pas
    // affiché n'aurait aucun sens.
    expect(w.find('#resultats-duree-bascule').exists()).toBe(false)
  })

  it('affiche la durée une fois la bascule activée', () => {
    rechercheFaite()
    useUiConfigStore().config.search_time_enabled = true

    const w = monter()
    expect(w.find('#resultats-duree').text()).toBe('en 188 ms')
  })

  it('masque la durée si l’utilisateur l’a refusée, sans retirer le bouton', () => {
    rechercheFaite()
    useUiConfigStore().config.search_time_enabled = true
    usePreferencesStore().showSearchTime = false

    const w = monter()
    expect(w.find('#resultats-duree').exists()).toBe(false)
    // Le bouton doit rester : c'est le seul moyen de la faire revenir.
    expect(w.find('#resultats-duree-bascule').exists()).toBe(true)
  })

  // Cas d'une API antérieure à la mesure : la bascule est active mais il
  // n'y a rien à montrer. Un bouton « Afficher le temps » qui n'affiche
  // rien serait pire que pas de bouton du tout.
  it('n’affiche ni durée ni bouton quand l’API n’en renvoie pas', () => {
    rechercheFaite(null)
    useUiConfigStore().config.search_time_enabled = true

    const w = monter()
    expect(w.find('#resultats-duree').exists()).toBe(false)
    expect(w.find('#resultats-duree-bascule').exists()).toBe(false)
  })

  it('détaille moteur et traitement au survol', () => {
    rechercheFaite()
    useUiConfigStore().config.search_time_enabled = true

    const titre = monter().find('#resultats-duree').attributes('title') || ''
    expect(titre).toContain('43 ms')
    expect(titre).toContain('188 ms')
  })
})

// Le sélecteur de tri est le dernier enfant de la barre d'actions, donc
// celui qui s'affiche le plus à droite. Cette position se vérifie sur le
// DOM rendu et non à l'œil : c'est un ordre de gabarit, que n'importe
// quel ajout de bouton en fin de barre défait sans bruit.
//
// Le tri est écrit en balisage DSFR direct, sans DsfrSelect : ces tests
// montent donc le vrai `select` et agissent dessus comme le ferait un
// utilisateur, plutôt que d'observer l'événement d'un composant stubbé.
describe('ResultsToolbar — sélecteur de tri', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    // setSort() relance une recherche : sans réponse, la promesse
    // échouerait après le test, hors de toute assertion.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ total: 0, hits: [], facets: {} }),
        }),
      ),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  function monterAvecTri() {
    rechercheFaite()
    useUiConfigStore().config.sort_enabled = true
    return mount(ResultsToolbar, {
      global: { stubs: { DsfrButton: true, DsfrAlert: true } },
    })
  }

  it('place le tri en dernier dans la barre d’actions', () => {
    const actions = monterAvecTri().find('.ds-toolbar__actions').element
    const dernier = actions.lastElementChild as HTMLElement
    // Le composant enveloppe son `select` dans un groupe DSFR : on
    // cherche donc DANS le dernier enfant, pas l'identifiant sur lui.
    expect(dernier.querySelector('#resultats-tri')).not.toBeNull()
  })

  it('applique le tri choisi et relance la recherche', async () => {
    const store = useSearchStore()
    const w = monterAvecTri()
    // Sans critère actif, doSearch() sort avant l'appel réseau : le
    // contrôle ne dirait alors rien du déclenchement.
    store.query = 'rapport'

    const select = w.find('select#resultats-tri')
    await select.setValue('filename')

    expect(store.sort).toBe('filename')
    // Relancée depuis la première page, sinon on resterait sur une page
    // profonde d'un ordre qui n'existe plus.
    expect(store.page).toBe(1)
    expect(vi.mocked(fetch)).toHaveBeenCalled()
  })

  // Les quatre ordres et RIEN d'autre : l'option d'invite vide et
  // désactivée que DsfrSelect ajoutait en tête ne désignait aucun tri.
  // C'est ce contrôle qui empêche de revenir au composant par commodité
  // sans voir réapparaître cette entrée.
  it('propose les quatre ordres de tri, sans option vide', () => {
    const options = monterAvecTri()
      .findAll('select#resultats-tri option')
      .map((o) => o.attributes('value'))
    expect(options).toEqual(SORT_OPTIONS.map((o) => o.value))
  })

  // Le libellé doit rester rattaché au champ : en balisage direct, plus
  // rien ne pose le `for` à notre place.
  // Le `select` n'est pas en v-model mais en liaison simple : sans ce
  // contrôle, rien ne dirait que l'ordre courant est bien celui que la
  // liste montre comme sélectionné au premier rendu.
  it('montre l’ordre courant comme sélectionné', () => {
    const store = useSearchStore()
    store.sort = 'size'
    const select = monterAvecTri().find('select#resultats-tri')
      .element as HTMLSelectElement
    expect(select.value).toBe('size')
  })

  it('rattache le libellé au champ', () => {
    const w = monterAvecTri()
    expect(w.find('label[for="resultats-tri"]').text()).toBe('Trier par')
  })
})
