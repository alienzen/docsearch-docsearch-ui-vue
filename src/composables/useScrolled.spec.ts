import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Ref } from 'vue'
import { useScrolled } from './useScrolled'

/**
 * `window.scrollY` est une propriété calculée sous jsdom, sans
 * défilement réel à piloter : on remplace son accesseur, puis on
 * déclenche l'évènement que le composable écoute.
 */
let position = 0

function defiler(y: number) {
  position = y
  window.dispatchEvent(new Event('scroll'))
}

vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => position)

// Les composants montés restent à l'écoute du défilement tant qu'ils ne
// sont pas démontés : sans ce ménage, celui d'un test réagirait aux
// évènements du suivant.
const montes: { unmount: () => void }[] = []

function monter(seuil?: number, seuilRetour?: number) {
  const vu: { scrolled?: Ref<boolean> } = {}
  const Hote = defineComponent({
    setup() {
      vu.scrolled =
        seuil === undefined ? useScrolled().scrolled : useScrolled(seuil, seuilRetour).scrolled
      return () => h('div')
    },
  })
  const wrapper = mount(Hote)
  montes.push(wrapper)
  return { wrapper, scrolled: vu.scrolled as Ref<boolean> }
}

/** Démontage explicite d'un test, retiré du ménage pour ne pas démonter deux fois. */
function demonter(wrapper: { unmount: () => void }) {
  montes.splice(montes.indexOf(wrapper), 1)
  wrapper.unmount()
}

describe('useScrolled', () => {
  afterEach(() => {
    montes.splice(0).forEach((w) => w.unmount())
    position = 0
  })

  it('bascule au seuil unique, dans les deux sens', () => {
    const { scrolled } = monter(100)
    expect(scrolled.value).toBe(false)
    defiler(150)
    expect(scrolled.value).toBe(true)
    defiler(80)
    expect(scrolled.value).toBe(false)
  })

  it('garde son seuil par défaut de 300 px', () => {
    const { scrolled } = monter()
    defiler(290)
    expect(scrolled.value).toBe(false)
    defiler(310)
    expect(scrolled.value).toBe(true)
  })

  /**
   * Le cœur de l'hystérésis : entre les deux seuils, l'état ne change
   * pas — il conserve celui qu'il avait en y entrant. C'est ce qui
   * empêche l'en-tête réduit de battre quand son repli remonte la page.
   */
  it('ne relâche l’état qu’au seuil bas, et le rétablit au seuil haut', () => {
    const { scrolled } = monter(120, 40)
    defiler(80)
    expect(scrolled.value).toBe(false)
    defiler(130)
    expect(scrolled.value).toBe(true)
    defiler(80)
    expect(scrolled.value).toBe(true)
    defiler(30)
    expect(scrolled.value).toBe(false)
  })

  it('mesure la position dès le montage, sans attendre un défilement', () => {
    position = 500
    const { scrolled } = monter(120, 40)
    expect(scrolled.value).toBe(true)
  })

  it('cesse d’écouter une fois démonté', () => {
    const { wrapper, scrolled } = monter(120, 40)
    demonter(wrapper)
    defiler(500)
    expect(scrolled.value).toBe(false)
  })
})
