import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import ModulePage from './ModulePage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'

// Écran hôte des modules. Ce qui compte ici n'est pas l'apparence : c'est
// qu'un écran ne s'affiche QUE s'il est déclaré par un module actif — le
// paramètre d'URL ne décide de rien.

const PAGE = { module: 'jira', libelle: 'Tableau de bord', chemin: '/ext/jira/tableau', icone: null }

function repondre(pages: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ plugin_pages: pages, plugin_nav: [], plugin_actions: [] }),
    }),
  )
}

function monter(recherche: string) {
  // jsdom ne permet pas d'affecter window.location : on remplace la
  // seule partie que la page lit.
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: recherche },
    writable: true,
  })
  return mount(ModulePage, {
    global: { plugins: [createPinia()], components: { VIcon, RouterLink: RouterLinkShim } },
  })
}

describe('ModulePage', () => {
  beforeEach(() => repondre([PAGE]))
  afterEach(() => vi.unstubAllGlobals())

  it('affiche l’écran déclaré par un module actif', async () => {
    const w = monter('?m=jira')
    await flushPromises()
    const cadre = w.find('[data-testid="module-cadre"]')
    expect(cadre.exists()).toBe(true)
    expect(cadre.attributes('src')).toBe('/ext/jira/tableau')
    expect(cadre.attributes('title')).toBe('Tableau de bord')
  })

  it('interdit à l’iframe de détourner la navigation de l’onglet', async () => {
    // `allow-top-navigation` est volontairement absent : c'est le seul
    // vrai gain du bac à sable, l'iframe étant de même origine.
    const w = monter('?m=jira')
    await flushPromises()
    expect(w.find('[data-testid="module-cadre"]').attributes('sandbox')).not.toContain(
      'allow-top-navigation',
    )
  })

  it('refuse un module qu’aucune déclaration ne couvre', async () => {
    // Sans ce contrôle, ?m=n-importe-quoi ferait charger une iframe vers
    // une adresse arbitraire du site.
    const w = monter('?m=inexistant')
    await flushPromises()
    expect(w.find('[data-testid="module-cadre"]').exists()).toBe(false)
    expect(w.text()).toContain('Aucun module actif ne déclare cet écran')
  })

  it('refuse un paramètre absent', async () => {
    const w = monter('')
    await flushPromises()
    expect(w.find('[data-testid="module-cadre"]').exists()).toBe(false)
  })

  it('n’affiche plus l’écran d’un module arrêté', async () => {
    // L'API ne rend que les accroches des modules ACTIFS : un module
    // arrêté disparaît donc d'ici sans que cette page ait à le savoir.
    repondre([])
    const w = monter('?m=jira')
    await flushPromises()
    expect(w.find('[data-testid="module-cadre"]').exists()).toBe(false)
  })
})
