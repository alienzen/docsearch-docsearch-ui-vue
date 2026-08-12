import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FeedbackBar from './FeedbackBar.vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

// Le remerciement s'efface de lui-même : sans minuteur, il restait sous
// les résultats jusqu'à la recherche suivante. Ce qui se vérifie ici est
// surtout ce qu'il ne doit PAS laisser derrière lui — la question et ses
// boutons, qui inviteraient à voter une seconde fois sur la même
// recherche.

function stubFetch() {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  vi.stubGlobal('fetch', mock)
  return mock
}

/** Monte la barre sur une recherche en place, bascule d'admin activée. */
function monter() {
  useUiConfigStore().engagement.feedback_enabled = true
  useSearchStore().searchId = 'recherche-1'
  return mount(FeedbackBar)
}

describe('FeedbackBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    stubFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('remercie une fois l’avis enregistré', async () => {
    const w = monter()
    await w.find('#avis-utile').trigger('click')
    await flushPromises()

    expect(w.find('#avis-merci').exists()).toBe(true)
    expect(w.find('#avis-utile').exists()).toBe(false)
  })

  it('efface le remerciement sans intervention', async () => {
    const w = monter()
    await w.find('#avis-utile').trigger('click')
    await flushPromises()

    vi.advanceTimersByTime(3000)
    await flushPromises()

    expect(w.find('#avis-merci').exists()).toBe(false)
    // Toute la barre part avec lui : la question ne doit pas revenir,
    // sinon l'avis se donne deux fois.
    expect(w.find('#avis').exists()).toBe(false)
  })

  it('redonne la question à la recherche suivante', async () => {
    const w = monter()
    await w.find('#avis-peu-utile').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(3000)
    await flushPromises()

    useSearchStore().searchId = 'recherche-2'
    await flushPromises()

    expect(w.find('#avis-utile').exists()).toBe(true)
    expect(w.find('#avis-merci').exists()).toBe(false)
  })

  // Un avis donné juste avant une nouvelle recherche laissait un minuteur
  // en vol : en se déclenchant, il aurait masqué la barre de la recherche
  // suivante, sur laquelle aucun avis n'a encore été donné.
  it('n’emporte pas la barre de la recherche suivante', async () => {
    const w = monter()
    await w.find('#avis-utile').trigger('click')
    await flushPromises()

    useSearchStore().searchId = 'recherche-2'
    await flushPromises()
    vi.advanceTimersByTime(3000)
    await flushPromises()

    expect(w.find('#avis-utile').exists()).toBe(true)
  })
})
