import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useHeaderReduit } from './useHeaderReduit'

/** Voir useScrolled.spec.ts : jsdom ne défile pas, on simule. */
let position = 0

function defiler(y: number) {
  position = y
  window.dispatchEvent(new Event('scroll'))
}

vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => position)

const reduit = () => document.documentElement.classList.contains('ds-header-reduit')

// Un composant non démonté continue d'écouter le défilement : sans ce
// ménage, celui d'un test poserait la classe pendant le suivant.
const montes: { unmount: () => void }[] = []

function monter(actif = ref(true)) {
  const Hote = defineComponent({
    setup() {
      useHeaderReduit(actif)
      return () => h('div')
    },
  })
  const wrapper = mount(Hote)
  montes.push(wrapper)
  return { wrapper, actif }
}

/** Démontage explicite d'un test, retiré du ménage pour ne pas démonter deux fois. */
function demonter(wrapper: { unmount: () => void }) {
  montes.splice(montes.indexOf(wrapper), 1)
  wrapper.unmount()
}

describe('useHeaderReduit', () => {
  afterEach(() => {
    montes.splice(0).forEach((w) => w.unmount())
    position = 0
    document.documentElement.classList.remove('ds-header-reduit')
  })

  it('ne réduit rien tant que la page n’a pas défilé', () => {
    monter()
    expect(reduit()).toBe(false)
  })

  it('réduit l’en-tête au-delà du seuil, le rétablit en haut de page', async () => {
    monter()
    defiler(200)
    await nextTick()
    expect(reduit()).toBe(true)
    defiler(0)
    await nextTick()
    expect(reduit()).toBe(false)
  })

  it('ne réduit jamais l’en-tête quand le drapeau est éteint', async () => {
    monter(ref(false))
    defiler(500)
    await nextTick()
    expect(reduit()).toBe(false)
  })

  /**
   * Le cas réel : /ui-config répond APRÈS le montage de la page. Le
   * drapeau doit donc être relu sans qu'un nouvel évènement de
   * défilement survienne.
   */
  it('applique un drapeau allumé après le montage, sans nouveau défilement', async () => {
    const { actif } = monter(ref(false))
    defiler(500)
    await nextTick()
    expect(reduit()).toBe(false)

    actif.value = true
    await nextTick()
    expect(reduit()).toBe(true)
  })

  it('rétablit l’en-tête si le drapeau s’éteint en cours de défilement', async () => {
    const { actif } = monter()
    defiler(500)
    await nextTick()
    expect(reduit()).toBe(true)

    actif.value = false
    await nextTick()
    expect(reduit()).toBe(false)
  })

  it('retire la classe au démontage', async () => {
    const { wrapper } = monter()
    defiler(500)
    await nextTick()
    expect(reduit()).toBe(true)

    demonter(wrapper)
    expect(reduit()).toBe(false)
  })
})
