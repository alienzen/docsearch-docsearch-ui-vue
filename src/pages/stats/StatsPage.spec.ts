import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import StatsPage from './StatsPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'

// Même garde-fou que ChatPage : monter la page détecte une boucle de
// rendu (dépassement de délai) et vérifie que les six panneaux se
// peuplent. Le bandeau « Accès refusé » est testé à part, car c'est le
// comportement qui protège la page d'un utilisateur non habilité.

/** Réponses minimales mais réalistes des six endpoints /admin/*. */
const RESPONSES: Record<string, unknown> = {
  '/admin/search-logs/summary': {
    total_searches: 2736,
    unique_users: 7,
    unique_ips: 3,
    by_day: [{ date: '2026-07-16', count: 168 }],
    feedback_up: 7,
    feedback_down: 4,
  },
  '/admin/nps-summary': {
    total_responses: 2,
    nps_score: 0,
    detractors: 1,
    passives: 0,
    promoters: 1,
  },
  '/admin/suggestions': {
    total: 1,
    results: [
      {
        id: 's1',
        timestamp: '2026-07-20T10:00:00Z',
        text: 'Ajouter un tri par pertinence',
        category: 'idea',
        status: 'nouveau',
        username: null,
      },
    ],
  },
  '/admin/search-logs/zero-results': {
    total_zero_result_searches: 12,
    results: [{ query: 'xyzzy', count: 3, last_seen: '2026-07-20T10:00:00Z' }],
  },
  '/admin/search-logs': {
    total: 1,
    results: [
      {
        id: 'l1',
        timestamp: '2026-07-20T10:00:00Z',
        username: 'alice.admin',
        query: 'rapport',
        total_results: 1439,
        result_files: ['a.docx', 'b.docx', 'c.docx', 'd.docx'],
        extension: ['.docx'],
        source: ['documents'],
        feedback: 'up',
      },
    ],
  },
  '/admin/audit-log': {
    total: 1,
    results: [
      {
        id: 'a1',
        timestamp: '2026-07-20T10:00:00Z',
        username: 'alice.admin',
        method: 'POST',
        path: '/admin/scan',
        path_params: {},
        body: { source: 'documents' },
      },
    ],
  },
  '/ui-config': { footer_enabled_admin: true, show_current_user_enabled_admin: true },
  '/is-admin': { is_admin: true, user: 'alice.admin', groups: ['docsearch-admins'] },
}

function respondWith(status = 200) {
  return vi.fn((url: string) => {
    const path = url.split('?')[0]
    const body = RESPONSES[path] ?? {}
    return Promise.resolve({
      ok: status === 200,
      status,
      json: () => Promise.resolve(status === 200 ? body : { detail: 'Accès réservé aux administrateurs' }),
    })
  })
}

function mountPage() {
  return mount(StatsPage, {
    global: {
      plugins: [createPinia()],
      components: { VIcon, RouterLink: RouterLinkShim },
    },
  })
}

/** Laisse les six chargements parallèles se résoudre. */
async function flush() {
  for (let i = 0; i < 6; i++) await nextTick()
}

/**
 * Ramène toutes les espaces à l'espace ordinaire : toLocaleString('fr-FR')
 * sépare les milliers par une espace fine insécable (U+202F), qui ne
 * correspond pas à l'espace tapée dans les attentes ci-dessous.
 */
function normalize(text: string) {
  return text.replace(/\s/g, ' ')
}

describe('StatsPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('se monte sans boucle de rendu', () => {
    vi.stubGlobal('fetch', respondWith())
    expect(mountPage().html()).toBeTruthy()
  })

  it('affiche les six panneaux', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    const text = wrapper.text()
    for (const title of [
      "Vue d'ensemble",
      'NPS',
      'Suggestions',
      'Recherches sans résultat',
      'Historique des recherches',
      "Journal d'audit",
    ]) {
      expect(text).toContain(title)
    }
  })

  it('peuple les panneaux avec les données de l’API', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    const text = normalize(wrapper.text())
    expect(text).toContain('2 736') // total des recherches, formaté en fr-FR
    expect(text).toContain('64 %') // 7 avis positifs sur 11
    expect(text).toContain('Ajouter un tri par pertinence')
    expect(text).toContain('xyzzy')
  })

  it('tronque la liste des documents retournés au-delà de trois', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    expect(wrapper.text()).toContain('a.docx, b.docx, c.docx +1')
  })

  it('remplace la page par un bandeau unique en cas de refus d’accès', async () => {
    // Un 403 vaut pour les six panneaux : mieux vaut un message clair
    // que six erreurs identiques empilées.
    vi.stubGlobal('fetch', respondWith(403))
    const wrapper = mountPage()
    await flush()
    expect(wrapper.text()).toContain('Accès refusé')
    expect(wrapper.text()).not.toContain("Journal d'audit")
  })
})
