import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { DUREE_FERMETURE_MS, useFermetureProgressive } from './useFermetureProgressive'

/**
 * Le composable ne rend rien : il est monté dans un composant hôte, seul
 * moyen d'avoir un cycle de vie — c'est `onBeforeUnmount` qui annule le
 * minuteur.
 */
function monter() {
  const ouvert = ref(false)
  const vu: { fermeture?: Ref<boolean> } = {}
  const Hote = defineComponent({
    setup() {
      vu.fermeture = useFermetureProgressive(ouvert)
      return () => h('div')
    },
  })
  const wrapper = mount(Hote)
  return { wrapper, ouvert, fermeture: vu.fermeture as Ref<boolean> }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useFermetureProgressive', () => {
  it('ne marque rien tant que le menu n’a pas été ouvert', async () => {
    const { fermeture } = monter()
    expect(fermeture.value).toBe(false)
    // Un menu fermé qui le reste ne doit pas se croire en train de se
    // fermer : la classe `fr-collapsing` lui rendrait sa hauteur pleine.
    vi.advanceTimersByTime(DUREE_FERMETURE_MS)
    await nextTick()
    expect(fermeture.value).toBe(false)
  })

  it('marque la fermeture le temps du fondu, puis la relâche', async () => {
    const { ouvert, fermeture } = monter()
    ouvert.value = true
    await nextTick()
    expect(fermeture.value).toBe(false)

    ouvert.value = false
    await nextTick()
    expect(fermeture.value).toBe(true)

    vi.advanceTimersByTime(DUREE_FERMETURE_MS - 1)
    expect(fermeture.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(fermeture.value).toBe(false)
  })

  it('relâche la fermeture dès la réouverture', async () => {
    const { ouvert, fermeture } = monter()
    ouvert.value = true
    await nextTick()
    ouvert.value = false
    await nextTick()
    expect(fermeture.value).toBe(true)

    // Rouvert avant la fin du fondu : le menu redevient franchement
    // ouvert, et le minuteur en cours ne doit plus rien décider.
    ouvert.value = true
    await nextTick()
    expect(fermeture.value).toBe(false)
    vi.advanceTimersByTime(DUREE_FERMETURE_MS)
    expect(fermeture.value).toBe(false)
  })

  it('annule le minuteur au démontage', async () => {
    const { wrapper, ouvert, fermeture } = monter()
    ouvert.value = true
    await nextTick()
    ouvert.value = false
    await nextTick()
    expect(fermeture.value).toBe(true)

    wrapper.unmount()
    vi.advanceTimersByTime(DUREE_FERMETURE_MS)
    // Le minuteur ne survit pas au composant : il n'écrit plus dans un
    // état qui n'est plus à l'écran.
    expect(vi.getTimerCount()).toBe(0)
  })
})
