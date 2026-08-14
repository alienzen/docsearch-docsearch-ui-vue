import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSearchShortcuts } from './useSearchShortcuts'
import { useSearchStore } from '@/stores/search'

/**
 * Ces tests portent sur la pagination au clavier : les flèches doivent
 * remonter en haut comme le fait un clic sur la pagination, sans quoi la
 * page suivante s'ouvre sur ses derniers résultats — le raccourci
 * s'utilisant précisément en fin de liste.
 */
const montes: { unmount: () => void }[] = []

function monter() {
  const Hote = defineComponent({
    setup() {
      useSearchShortcuts()
      return () => h('div')
    },
  })
  const wrapper = mount(Hote, { attachTo: document.body })
  montes.push(wrapper)
  return wrapper
}

function appuyer(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

/** Store d'une recherche aboutie, positionnée au milieu des résultats. */
function storePrepare() {
  const store = useSearchStore()
  store.hasSearched = true
  store.total = 100
  store.page = 2
  vi.spyOn(store, 'goToPage').mockResolvedValue(undefined)
  return store
}

describe('useSearchShortcuts — pagination au clavier', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // jsdom ne défile pas : `window.scrollTo` y lève « Not implemented »
    // au lieu d'être observable.
    vi.stubGlobal('scrollTo', vi.fn())
  })
  afterEach(() => {
    montes.splice(0).forEach((w) => w.unmount())
    vi.unstubAllGlobals()
  })

  it('avance d’une page et remonte en haut', () => {
    const store = storePrepare()
    monter()
    appuyer('ArrowRight')
    expect(store.goToPage).toHaveBeenCalledWith(3)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })

  it('recule d’une page et remonte en haut', () => {
    const store = storePrepare()
    monter()
    appuyer('ArrowLeft')
    expect(store.goToPage).toHaveBeenCalledWith(1)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })

  /**
   * Aux deux extrémités, la touche ne fait rien du tout : remonter sans
   * changer de page ferait croire à un changement qui n'a pas eu lieu.
   */
  it('ne remonte pas quand il n’y a pas de page où aller', () => {
    const store = storePrepare()
    store.page = 1
    monter()
    appuyer('ArrowLeft')
    expect(store.goToPage).not.toHaveBeenCalled()
    expect(window.scrollTo).not.toHaveBeenCalled()

    store.page = store.totalPages
    appuyer('ArrowRight')
    expect(store.goToPage).not.toHaveBeenCalled()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('ignore les flèches tant qu’aucune recherche n’a été lancée', () => {
    const store = storePrepare()
    store.hasSearched = false
    monter()
    appuyer('ArrowRight')
    expect(store.goToPage).not.toHaveBeenCalled()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  /**
   * « h » remonte la même page : le déplacement est ce que l'animation
   * donne à comprendre. Les flèches, elles, changent tout le contenu et
   * sautent (voir utils/scroll.ts).
   */
  it('anime la remontée du raccourci « h », mais pas celle des flèches', () => {
    storePrepare()
    monter()
    appuyer('h')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  /**
   * Les flèches servent d'abord à déplacer le curseur : dans un champ de
   * saisie, elles ne doivent pas changer de page.
   */
  it('laisse les flèches à la saisie dans un champ', () => {
    const store = storePrepare()
    monter()
    const champ = document.createElement('input')
    document.body.appendChild(champ)
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(store.goToPage).not.toHaveBeenCalled()
    champ.remove()
  })
})
