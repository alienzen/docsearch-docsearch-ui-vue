import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import StatsSearchLogsPanel from './StatsSearchLogsPanel.vue'

// Ce fichier couvre ce que la colonne « Nature » et la case
// « Recherches véritables seulement » PROMETTENT, et surtout ce qu'elles
// ne doivent pas promettre.
//
// Le journal contient deux générations de lignes : celles qui portent un
// numéro de page, et celles écrites avant sa capture, qui n'en ont pas.
// Afficher « Recherche » sur ces dernières présenterait comme un fait
// établi ce qui n'a jamais été enregistré — d'où le tiret, et d'où ces
// tests.

const LIGNES = {
  total: 4,
  results: [
    {
      id: 'l1',
      timestamp: '2026-08-16T10:00:00Z',
      username: 'bob.user',
      query: 'budget',
      total_results: 42,
      page: 1,
      exact: false,
      extension: ['.pdf'],
    },
    {
      id: 'l2',
      timestamp: '2026-08-16T10:00:30Z',
      username: 'bob.user',
      query: 'budget',
      total_results: 42,
      page: 3,
      exact: false,
    },
    {
      id: 'l3',
      timestamp: '2026-08-16T11:00:00Z',
      username: 'bob.user',
      query: 'délégation',
      total_results: 7,
      page: 1,
      exact: true,
    },
    // Ligne héritée : ni `page` ni `exact`.
    {
      id: 'l4',
      timestamp: '2026-08-01T09:00:00Z',
      username: 'bob.user',
      query: 'ancienne',
      total_results: 5,
    },
  ],
}

function stubFetch() {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(LIGNES),
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

async function monter() {
  const w = mount(StatsSearchLogsPanel, {
    global: { plugins: [createPinia()], components: { VIcon } },
  })
  await flushPromises()
  return w
}

function natures(w: Awaited<ReturnType<typeof monter>>) {
  return w.findAll('[data-testid="log-nature"]').map((n) => n.text())
}

describe('StatsSearchLogsPanel — nature et recherche exacte', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  it('distingue une recherche véritable d’un tour de page', async () => {
    stubFetch()
    const w = await monter()
    // La quatrième ligne n'a pas de numéro de page : elle reste un tiret,
    // et surtout pas « Recherche ».
    expect(natures(w)).toEqual(['Recherche', 'Page 3', 'Recherche', '—'])
  })

  it('signale la recherche exacte dans les critères', async () => {
    stubFetch()
    const w = await monter()
    const lignes = w.findAll('[data-testid="log-ligne"]')
    expect(lignes[2].text()).toContain('Recherche exacte')
    // `exact: false` ne doit rien afficher : la ligne porte bien son
    // critère de type, et rien de plus.
    expect(lignes[0].text()).toContain('PDF')
    expect(lignes[0].text()).not.toContain('Recherche exacte')
    // Ligne héritée : `exact` absent ne vaut pas « exacte ».
    expect(lignes[3].text()).not.toContain('Recherche exacte')
  })

  it('demande à l’API d’écarter les tours de page quand la case est cochée', async () => {
    const fetchMock = stubFetch()
    const w = await monter()

    await w.find('#logs-sans-navigation').setValue(true)
    await flushPromises()

    const appel = fetchMock.mock.calls.at(-1)?.[0] as string
    expect(appel).toContain('exclude_pagination=true')
  })

  // L'export doit couvrir ce que l'écran montre : un fichier contenant
  // les tours de page que la page masque ne serait pas l'export de ce
  // qu'on regarde.
  it('reporte le filtre sur le lien d’export', async () => {
    stubFetch()
    const w = await monter()
    expect(w.find('#logs-export').attributes('href')).not.toContain('exclude_pagination')

    await w.find('#logs-sans-navigation').setValue(true)
    await flushPromises()

    expect(w.find('#logs-export').attributes('href')).toContain('exclude_pagination=true')
  })

  it('décoche le filtre à la réinitialisation', async () => {
    stubFetch()
    const w = await monter()
    await w.find('#logs-sans-navigation').setValue(true)
    await flushPromises()

    await w.find('#logs-reinitialiser').trigger('click')
    await flushPromises()

    expect((w.find('#logs-sans-navigation').element as HTMLInputElement).checked).toBe(false)
  })
})
