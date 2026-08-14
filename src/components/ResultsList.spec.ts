import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultsList from './ResultsList.vue'
import { useSearchStore } from '@/stores/search'

// Ces tests portent sur le retour visuel d'attente, ajouté parce que
// rien ne signalait qu'une recherche était en cours : `loading` existait
// dans le store sans qu'aucune vue le consomme. Ils vérifient surtout la
// distinction entre les deux situations — écran vide et réaffinage —
// puisque c'est elle qui évite de faire clignoter la liste à chaque clic
// de facette.

function mountList() {
  return mount(ResultsList, {
    global: {
      stubs: {
        // Ces deux-là tirent la moitié du DSFR et ne concernent en rien
        // l'attente : les remplacer garde le test lisible et rapide.
        ResultCard: true,
        DsfrPagination: true,
        DsfrAlert: true,
      },
    },
  })
}

describe('ResultsList — indication d\'attente', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('affiche le spinner pleine zone quand aucun résultat n\'est encore là', () => {
    const store = useSearchStore()
    store.loading = true

    const w = mountList()
    expect(w.find('.ds-loading .ds-spinner').exists()).toBe(true)
    expect(w.text()).toContain('Recherche en cours')
    // L'annonce vocale compte autant que le cercle : sans elle, un
    // lecteur d'écran ne signale rien du tout.
    expect(w.find('[role="status"]').exists()).toBe(true)
  })

  it('garde les résultats affichés et les estompe lors d\'un réaffinage', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.results = [{ id: '1' }] as never
    store.loading = true

    const w = mountList()
    // Pas de bloc pleine zone : la liste reste en place, ce qui évite le
    // saut de défilement à chaque clic de facette.
    expect(w.find('.ds-loading').exists()).toBe(false)
    expect(w.classes()).toContain('ds-results--loading')
  })

  it('ne montre rien de particulier hors recherche', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.results = [{ id: '1' }] as never

    const w = mountList()
    expect(w.find('.ds-spinner').exists()).toBe(false)
    expect(w.classes()).not.toContain('ds-results--loading')
  })
})

describe('ResultsList — changement de page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // jsdom ne défile pas : `window.scrollTo` y lève « Not implemented »
    // au lieu d'être observable. On le remplace pour vérifier l'appel.
    vi.stubGlobal('scrollTo', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('remonte en haut de la page au clic sur la pagination', async () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.results = [{ id: '1' }] as never
    // Deux pages au moins, sans quoi la pagination n'est pas rendue.
    store.total = 100
    // La recherche elle-même n'est pas le sujet, et partirait vers une
    // API absente.
    const goToPage = vi.spyOn(store, 'goToPage').mockResolvedValue(undefined)

    const w = mountList()
    await w.findComponent({ name: 'DsfrPagination' }).vm.$emit('update:current-page', 2)

    // DsfrPagination compte à partir de zéro, le store à partir de un.
    expect(goToPage).toHaveBeenCalledWith(3)
    // Saut immédiat, et non animé : la liste est remplacée en entier,
    // il n'y a pas de déplacement à donner à voir (voir utils/scroll.ts).
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })
})
