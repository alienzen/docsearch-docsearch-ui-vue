import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import HelpPage from './HelpPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { SHORTCUTS } from '@/constants'
import { idsDupliques } from '@/test/ids'

// Page de contenu : rien n'y est chargé sinon la configuration de
// l'en-tête. L'intérêt du fichier est ailleurs — figer les points
// d'accroche de l'aide, dont les ancres de section, qui font de
// `/help#aide-syntaxe` un lien partageable.

function respondWith() {
  return vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
  )
}

async function monter() {
  vi.stubGlobal('fetch', respondWith())
  const wrapper = mount(HelpPage, {
    global: { plugins: [createPinia()], components: { VIcon, RouterLink: RouterLinkShim } },
  })
  for (let i = 0; i < 4; i++) await nextTick()
  return wrapper
}

describe('HelpPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })

  it('se monte sans boucle de rendu', async () => {
    expect((await monter()).html()).toBeTruthy()
  })

  it('ancre chaque section de l’aide', async () => {
    const wrapper = await monter()
    for (const id of [
      'aide-titre',
      'aide',
      'aide-raccourcis',
      'aide-raccourcis-tableau',
      'aide-syntaxe',
      'aide-operateurs-tableau',
      'aide-facettes-personnalisees',
      'aide-contact',
      'aide-version',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
  })

  it('marque chaque ligne répétée d’un data-testid', async () => {
    const wrapper = await monter()
    // Autant de lignes que de raccourcis déclarés : c'est ce qui
    // distingue une accroche réellement posée sur la boucle d'une
    // accroche posée par erreur sur le conteneur.
    expect(wrapper.findAll('[data-testid="aide-raccourci"]')).toHaveLength(SHORTCUTS.length)
    expect(wrapper.findAll('[data-testid="aide-operateur"]').length).toBeGreaterThan(1)
  })

  it('n’expose que des identifiants uniques', async () => {
    document.body.innerHTML = ''
    const wrapper = await monter()
    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })
})
