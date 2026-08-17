import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import StatsSummaryPanel from './StatsSummaryPanel.vue'

// Le total des recherches a changé de sens : il compte les recherches
// VÉRITABLES, tours de page écartés. Vu de l'écran, un compteur qui
// baisse sans un mot ressemble à une perte de données — d'où la mention
// « hors N tour(s) de page », et d'où ces tests.
//
// La mention d'assiette des temps, elle, se rapporte au nombre de LIGNES
// du journal : les tours de page y sont comptés, ce sont de vraies
// requêtes. Rapporter des lignes mesurées à un total de recherches
// comparerait deux ensembles différents.

const RESUME = {
  total_searches: 1537,
  total_logged: 1540,
  unique_users: 4,
  unique_ips: 2,
  by_day: [{ date: '2026-08-17', count: 155 }],
  feedback_up: 9,
  feedback_down: 9,
  by_group: [
    { group: 'rh', searches: 1200, feedback_up: 5, feedback_down: 2 },
    { group: '__sans_groupe__', searches: 337, feedback_up: 4, feedback_down: 7 },
  ],
  searches_by_group: [
    { group: 'rh', count: 1200 },
    { group: '__sans_groupe__', count: 337 },
  ],
  timing: {
    avg_ms: 385,
    p50_ms: 151,
    p95_ms: 1510,
    took_avg_ms: 351,
    slow_count: 38,
    slow_threshold_ms: 2000,
    measured: 1266,
  },
}

function stubFetch(body: unknown = RESUME) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }),
  )
}

async function monter() {
  const w = mount(StatsSummaryPanel, {
    global: { plugins: [createPinia()], components: { VIcon } },
  })
  await flushPromises()
  return w
}

/** Ramène l'espace fine insécable des milliers à une espace ordinaire. */
function normaliser(texte: string) {
  return texte.replace(/\s/g, ' ')
}

describe('StatsSummaryPanel — recherches véritables', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    stubFetch()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('annonce combien de tours de page sont écartés du total', async () => {
    const w = await monter()
    expect(normaliser(w.find('#summary-tours-de-page').text())).toBe('hors 3 tour(s) de page')
  })

  it('n’affiche pas la mention quand aucun tour de page n’est connu', async () => {
    // Historique entièrement antérieur à la capture du numéro de page :
    // l'écart est nul, et la mention n'apprendrait rien.
    stubFetch({ ...RESUME, total_searches: 1540, total_logged: 1540 })
    const w = await monter()
    expect(w.find('#summary-tours-de-page').exists()).toBe(false)
  })

  it('rapporte les temps mesurés aux LIGNES du journal, pas aux recherches', async () => {
    const w = await monter()
    const assiette = normaliser(w.find('#summary-duree-assiette').text())
    expect(assiette).toContain('1 266')
    expect(assiette).toContain('1 540')
    // 1 537 est le total des recherches : il n'a rien à faire ici.
    expect(assiette).not.toContain('1 537')
  })

  it('masque la mention d’assiette quand tout est mesuré', async () => {
    stubFetch({ ...RESUME, timing: { ...RESUME.timing, measured: 1540 } })
    const w = await monter()
    expect(w.find('#summary-duree-assiette').exists()).toBe(false)
  })
})
