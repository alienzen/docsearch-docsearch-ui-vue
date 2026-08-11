import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import StatsHelpPage from './StatsHelpPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { STATS_SHORTCUTS } from '@/constants'
import { idsDupliques } from '@/test/ids'

const RESPONSES: Record<string, unknown> = {
  '/ui-config': { footer_enabled_admin: true, show_current_user_enabled_admin: true },
  '/is-admin': { is_admin: true, user: 'alice.admin', groups: ['docsearch-admins'] },
}

function respondWith() {
  return vi.fn((url: string) => {
    const path = url.split('?')[0]
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(RESPONSES[path] ?? {}),
    })
  })
}

async function monter() {
  vi.stubGlobal('fetch', respondWith())
  const wrapper = mount(StatsHelpPage, {
    global: { plugins: [createPinia()], components: { VIcon, RouterLink: RouterLinkShim } },
  })
  // flushPromises et non un nombre fixe de nextTick : le menu du compte
  // n'apparaît qu'au retour de /is-admin, appelé APRÈS /ui-config — six
  // ticks n'y suffisent pas, et le menu manquant ne se voit pas.
  await flushPromises()
  return wrapper
}

describe('StatsHelpPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })

  it('se monte sans boucle de rendu', async () => {
    expect((await monter()).html()).toBeTruthy()
  })

  it('ancre chaque section de l’aide des statistiques', async () => {
    const wrapper = await monter()
    for (const id of [
      'aide-stats-titre',
      'aide-stats-raccourcis',
      'aide-stats-raccourcis-tableau',
      'aide-stats-panneaux',
      'aide-stats-vue-ensemble',
      'aide-stats-nps',
      'aide-stats-suggestions',
      'aide-stats-zero',
      'aide-stats-historique',
      'aide-stats-audit',
      'aide-stats-groupes',
      'aide-stats-contact',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
  })

  it('marque chaque ligne de raccourci d’un data-testid', async () => {
    const wrapper = await monter()
    expect(wrapper.findAll('[data-testid="aide-stats-raccourci"]')).toHaveLength(
      STATS_SHORTCUTS.length,
    )
  })

  // La page de statistiques ne branche PAS « r » (pas de rechargement
  // global) : l'aide ne doit donc pas la publier, sous peine de décrire
  // une touche inopérante.
  it('ne publie pas le rechargement global', async () => {
    const wrapper = await monter()
    const touches = wrapper
      .findAll('[data-testid="aide-stats-raccourci"] kbd')
      .map((k) => k.text())
    expect(touches).not.toContain('r')
    expect(touches).toContain('t')
  })

  it('renvoie vers la page de statistiques depuis le menu du compte', async () => {
    const wrapper = await monter()
    const hrefs = wrapper.findAll('.fr-menu__list a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/stats.html')
    expect(hrefs).toContain('/admin.html')
    // Le menu du compte ne se rend que s'il reste au moins un lien
    // rapide : DsfrHeader conditionne tout le bloc d'outils à
    // `quickLinks.length`. La déconnexion disparaîtrait avec lui.
    expect(hrefs).toContain('/connexion?deconnexion=1')
  })

  it('n’expose que des identifiants uniques', async () => {
    document.body.innerHTML = ''
    const wrapper = await monter()
    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })
})
