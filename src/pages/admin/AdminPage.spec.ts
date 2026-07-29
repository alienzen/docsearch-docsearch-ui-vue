import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import AdminPage from './AdminPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'

// Même garde-fou que ChatPage et StatsPage : monter la page détecte une
// boucle de rendu (dépassement de délai) plutôt que de figer un onglet.
// C'est la page la plus lourde — 12 panneaux, 5 groupes.

const RESPONSES: Record<string, unknown> = {
  '/admin/status': {
    elasticsearch: { up: true, status: 'green' },
    redis: { up: true },
    kafka: { up: true },
    tika: { up_count: 1, total: 1 },
    workers: { active_workers: 4, pending_documents: 0 },
    watcher: { alive: true, last_seen_seconds_ago: 2 },
  },
  '/admin/all-sources': {
    documents: {
      type: 'file',
      label: 'Documents',
      es_index: 'documents',
      indexed: 23059,
      size_bytes: 1069000000,
      searchable: true,
      collectable: true,
    },
  },
  '/admin/file-sources': { documents: { es_index: 'documents', folder: '', label: 'Documents' } },
  '/admin/filetypes': { pdf: { enabled: true, max_size_mb: 50 } },
  '/admin/path-filters': { excluded: ['tmp'], included: [] },
  '/admin/sql-sources': {},
  '/admin/sql-dsns': [],
  '/admin/web-sources': {},
  '/admin/config': { worker_batch_size: 50 },
  '/ui-config': { footer_enabled_admin: true, show_current_user_enabled_admin: true },
  '/engagement-config': { feedback_enabled: true, nps_enabled: false, suggestions_enabled: true },
  '/is-admin': { is_admin: true, user: 'alice.admin', groups: ['docsearch-admins'] },
}

function respondWith(status = 200) {
  return vi.fn((url: string) => {
    const path = url.split('?')[0]
    return Promise.resolve({
      ok: status === 200,
      status,
      json: () =>
        Promise.resolve(
          status === 200
            ? (RESPONSES[path] ?? {})
            : { detail: "Accès réservé aux membres du groupe 'docsearch-admins'" },
        ),
    })
  })
}

function mountPage() {
  return mount(AdminPage, {
    global: {
      plugins: [createPinia()],
      components: { VIcon, RouterLink: RouterLinkShim },
    },
  })
}

async function flush() {
  for (let i = 0; i < 8; i++) await nextTick()
}

describe('AdminPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })

  it('se monte sans boucle de rendu', () => {
    vi.stubGlobal('fetch', respondWith())
    expect(mountPage().html()).toBeTruthy()
  })

  it('affiche les cinq groupes de panneaux', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    const text = wrapper.text()
    for (const group of [
      "Vue d'ensemble",
      'Sources fichiers',
      'Sources SQL',
      'Sources web',
      'Interface et engagement',
    ]) {
      expect(text).toContain(group)
    }
  })

  it('peuple les panneaux avec les données de l’API', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    const text = wrapper.text().replace(/\s/g, ' ')
    expect(text).toContain('État des composants')
    expect(text).toContain('23 059') // documents de la source principale
    expect(text).toContain('Documents')
  })

  it('remplace la page par un bandeau unique en cas de refus d’accès', async () => {
    // Un 403 vaut pour les douze panneaux : un seul message vaut mieux
    // que douze « Accès refusé » empilés.
    vi.stubGlobal('fetch', respondWith(403))
    const wrapper = mountPage()
    await flush()
    expect(wrapper.text()).toContain('Accès refusé')
    expect(wrapper.text()).not.toContain('Sources SQL')
  })
})
