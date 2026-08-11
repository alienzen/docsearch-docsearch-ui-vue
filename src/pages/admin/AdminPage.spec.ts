import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import AdminPage from './AdminPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { idsDupliques } from '@/test/ids'

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
  // ⚠️ DEUX entrées par liste, jamais une seule : c'est ce qui permet au
  // contrôle d'unicité des identifiants de démontrer quelque chose. Avec
  // une entrée, un `id` littéral posé dans un `v-for` ne se dédouble
  // jamais et le contrôle passe au vert sans rien vérifier.
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
    agents: {
      type: 'sql',
      label: 'Agents',
      es_index: 'agents',
      indexed: 995,
      size_bytes: 12000000,
      searchable: true,
      collectable: false,
    },
  },
  '/admin/file-sources': {
    documents: { es_index: 'documents', folder: '', label: 'Documents' },
    archives: { es_index: 'archives', folder: 'archives', label: 'Archives' },
  },
  '/admin/filetypes': {
    pdf: { enabled: true, max_size_mb: 50 },
    docx: { enabled: false, max_size_mb: 20 },
  },
  '/admin/path-filters': { excluded: ['tmp', 'brouillons'], included: ['public'] },
  '/admin/sql-sources': {
    agents: {
      db_type: 'postgresql',
      connection_ref: 'annuaire',
      query: 'SELECT id, nom FROM agents',
      id_column: 'id',
      es_index: 'agents',
      fields: [],
      poll_interval_seconds: 3600,
      label: 'Agents',
    },
    rap: {
      db_type: 'mysql',
      connection_ref: 'metier',
      query: 'SELECT id, objet FROM rapports',
      id_column: 'id',
      es_index: 'rap',
      fields: [],
      poll_interval_seconds: 7200,
      label: 'Rapports',
    },
  },
  '/admin/sql-dsns': [
    { name: 'annuaire', hint: 'postgresql://…/annuaire' },
    { name: 'metier', hint: 'mysql://…/metier' },
  ],
  '/admin/web-sources': {
    intranet: {
      label: 'Intranet',
      crawl_index: 'intranet',
      es_index: 'intranet',
      poll_interval_seconds: 86400,
      acl_public: true,
      paused: false,
      description: 'Site interne',
    },
    wiki: {
      label: 'Wiki',
      crawl_index: 'wiki',
      es_index: 'wiki',
      poll_interval_seconds: 43200,
      acl_public: false,
      paused: true,
      description: 'Wiki métier',
    },
  },
  '/admin/config': { worker_batch_size: 50 },
  '/ui-config': { footer_enabled_admin: true, show_current_user_enabled_admin: true },
  '/engagement-config': { feedback_enabled: true, nps_enabled: false, suggestions_enabled: true },
  '/is-admin': { is_admin: true, user: 'alice.admin', groups: ['docsearch-admins'] },
  // Arborescence de la source par défaut : sans elle, AdminTreeNode —
  // le seul composant RÉCURSIF de la page — n'est jamais rendu, et son
  // absence d'identifiant ne serait donc jamais éprouvée.
  '/admin/file-sources/documents/tree': {
    entries: [
      { name: 'rapports', path: 'rapports', type: 'dir', excluded: false, included: false },
      { name: 'note.pdf', path: 'note.pdf', type: 'file', excluded: true, included: false },
    ],
  },
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

  it('pose les identifiants des zones des douze panneaux', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    for (const id of [
      'admin-outils',
      'admin-recharger',
      'admin-tout-replier',
      'status-cartes',
      'status-versions',
      'status-versions-titre',
      'allsources-tableau',
      'filesources-tableau',
      'filesources-ajouter',
      'filetypes-tableau',
      'filetypes-ajouter',
      'filetypes-defauts',
      'pathfilters-exclus',
      'pathfilters-inclus',
      'pathfilters-exclure',
      'pathfilters-inclure',
      'pathfilters-apercu',
      'scan-lancer',
      'sqlsources-tableau',
      'sqlsources-nouvelle',
      'sqlsources-dsn-tableau',
      'sqlsources-dsn-enregistrer',
      'websources-tableau',
      'websources-ajouter',
      'engagement-bascules',
      'ui-config-bascules',
      'ui-config-theme-recherche',
      'ui-config-theme-admin',
      'config-tableau',
      'config-defauts',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
  })

  it('marque chaque ligne répétée d’un data-testid', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    // Deux entrées par liste dans les bouchons — voir RESPONSES.
    for (const testid of [
      'allsources-ligne',
      'filesources-ligne',
      'filetypes-ligne',
      'sqlsources-ligne',
      'sqlsources-dsn-ligne',
      'websources-ligne',
      'arbre-entree',
    ]) {
      expect(wrapper.findAll(`[data-testid="${testid}"]`), testid).toHaveLength(2)
    }
    // Les motifs de filtres : deux exclus, un inclus.
    expect(wrapper.findAll('[data-testid="pathfilters-exclu"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="pathfilters-inclus-motif"]')).toHaveLength(1)
    // La clé métier reste accessible à côté de la marque.
    expect(
      wrapper.findAll('[data-testid="filesources-ligne"]').map((l) => l.attributes('data-source')),
    ).toEqual(['documents', 'archives'])
  })

  it('garde des identifiants uniques dans le formulaire SQL, colonnes comprises', async () => {
    // Le formulaire n'existe qu'à la demande, et ses lignes de mapping
    // portent un `id` INDEXÉ (`sql-facet-0`, `sql-facet-1`) : c'est le
    // seul endroit de la page où une duplication dépend d'une action de
    // l'utilisateur, donc invisible sur la page au repos.
    document.body.innerHTML = ''
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    await wrapper.find('#sqlsources-nouvelle').trigger('click')
    await flush()
    expect(wrapper.find('#sql-formulaire').exists()).toBe(true)

    // Une source neuve s'ouvre déjà avec une ligne de mapping vierge :
    // deux clics en font donc trois, pas deux.
    await wrapper.find('#sql-colonne-ajouter').trigger('click')
    await wrapper.find('#sql-colonne-ajouter').trigger('click')
    await flush()
    expect(wrapper.findAll('[data-testid="sql-colonne"]')).toHaveLength(3)
    for (const i of [0, 1, 2]) {
      expect(wrapper.find(`#sql-facet-${i}`).exists(), `sql-facet-${i}`).toBe(true)
    }

    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })

  it('n’expose que des identifiants uniques', async () => {
    // Vider le corps du document : les modales des tests précédents y
    // sont téléportées et y restent, faute de démontage.
    document.body.innerHTML = ''
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
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
