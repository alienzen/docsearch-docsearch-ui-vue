import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import AdminHelpPage from './AdminHelpPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { ADMIN_SHORTCUTS } from '@/constants'
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
  const wrapper = mount(AdminHelpPage, {
    global: { plugins: [createPinia()], components: { VIcon, RouterLink: RouterLinkShim } },
  })
  for (let i = 0; i < 6; i++) await nextTick()
  return wrapper
}

describe('AdminHelpPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })

  it('se monte sans boucle de rendu', async () => {
    expect((await monter()).html()).toBeTruthy()
  })

  it('ancre chaque section de l’aide administrateur', async () => {
    const wrapper = await monter()
    for (const id of [
      'aide-admin-titre',
      'aide-admin-raccourcis',
      'aide-admin-raccourcis-tableau',
      'aide-admin-sources',
      'aide-admin-etat',
      'aide-admin-apparence',
      'aide-admin-contact',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
  })

  it('marque chaque ligne de raccourci d’un data-testid', async () => {
    const wrapper = await monter()
    expect(wrapper.findAll('[data-testid="aide-admin-raccourci"]')).toHaveLength(
      ADMIN_SHORTCUTS.length,
    )
  })

  it('n’expose que des identifiants uniques', async () => {
    document.body.innerHTML = ''
    const wrapper = await monter()
    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })
})
