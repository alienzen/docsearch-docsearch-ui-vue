import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DOMWrapper, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import AdminPage from './AdminPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { idsDupliques } from '@/test/ids'
import { SECTIONS } from './sections'

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

/**
 * `attachTo` seulement pour les tests qui regardent le focus : il ne
 * s'établit que sur un élément réellement dans le document, et attacher
 * systématiquement laisserait le corps du document jonché entre les
 * tests.
 */
function mountPage(attachTo?: HTMLElement) {
  return mount(AdminPage, {
    attachTo,
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
    // jsdom n'implémente ni ResizeObserver — dont `useHeaderHeight` se
    // sert pour caler le sommaire sous l'en-tête collant — ni le
    // défilement, où `window.scrollTo` lève « Not implemented ».
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    vi.stubGlobal('scrollTo', vi.fn())
  })

  it('se monte sans boucle de rendu', () => {
    vi.stubGlobal('fetch', respondWith())
    expect(mountPage().html()).toBeTruthy()
  })

  // Liste EXACTE et ORDONNÉE, pas une suite de `toContain` sur le texte
  // de la page : « Recherche » se retrouve dans une bonne part des
  // libellés de l'écran, et un groupe absent y passerait donc inaperçu.
  // L'ordre compte aussi — c'est lui que suivent les raccourcis chiffrés.
  it('affiche les sept groupes de panneaux, dans l’ordre', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    const titres = wrapper
      .findAll('details.ds-panel-block--group > summary')
      .map((s) => s.text().trim())
    expect(titres).toEqual([
      "Vue d'ensemble",
      'Sources fichiers',
      'Sources SQL',
      'Sources web',
      // Un groupe à part, et pas sous « Sources » : un module peut
      // n'apporter aucune source et n'exister que pour son écran.
      'Modules complémentaires',
      'Recherche',
      'Interface et engagement',
    ])
  })

  // sections.ts est la source du sommaire, du bouton « Tout replier » et
  // des raccourcis chiffrés : ce qu'elle déclare doit être EXACTEMENT ce
  // que le gabarit rend, dans le même ordre. C'est ce contrôle qui rend
  // la duplication des titres acceptable.
  it('rend exactement les groupes et panneaux déclarés dans sections.ts', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    // Le premier nœud texte du <summary> seulement : le sous-titre le
    // suit dans un <small>, et `text()` recollerait les deux.
    const titreDe = (details: DOMWrapper<Element>) =>
      details.find('summary').element.childNodes[0]?.textContent?.trim()

    for (const groupe of SECTIONS) {
      const details = wrapper.find(`details#${groupe.id}`)
      expect(details.exists(), groupe.id).toBe(true)
      expect(titreDe(details)).toBe(groupe.titre)

      // Les panneaux du groupe, dans l'ordre, et lui seuls.
      const rendus = details
        .findAll(':scope > .fr-accordion__inner > details.ds-panel-block')
        .map((d) => ({ id: d.attributes('id'), titre: titreDe(d) }))
      expect(rendus, groupe.id).toEqual(groupe.panneaux.map((p) => ({ id: p.id, titre: p.titre })))
    }

    // Et rien d'autre : un panneau ajouté au gabarit hors de tout groupe
    // déclaré échapperait aux boucles ci-dessus.
    expect(wrapper.findAll('details.ds-panel-block--group')).toHaveLength(SECTIONS.length)
    expect(wrapper.findAll('details.ds-panel-block:not(.ds-panel-block--group)')).toHaveLength(
      SECTIONS.flatMap((g) => g.panneaux).length,
    )
  })

  it('liste tous les groupes et panneaux dans le sommaire', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    expect(wrapper.findAll('[data-testid="sommaire-section"]').map((a) => a.text())).toEqual(
      SECTIONS.map((g) => g.titre),
    )
    expect(wrapper.findAll('[data-testid="sommaire-panneau"]').map((a) => a.text())).toEqual(
      SECTIONS.flatMap((g) => g.panneaux.map((p) => p.titre)),
    )
  })

  // Le cas d'usage qui a motivé le sommaire : taper « alerte » et
  // atterrir SUR la case, pas sur le panneau ni sur le groupe.
  it('mène de la recherche du sommaire à la case à cocher, panneau replié compris', async () => {
    document.body.innerHTML = ''
    // Groupe ET panneau repliés au départ : le saut doit ouvrir les deux.
    localStorage.setItem('docsearch-admin-collapsed-groups', '["group-interface"]')
    localStorage.setItem('docsearch-admin-collapsed-panels', '["ui-config-panel"]')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()

    expect(wrapper.find('details#group-interface').attributes('open')).toBeUndefined()

    const champ = wrapper.find('#sommaire-recherche')
    await champ.setValue('alerte')
    const propositions = wrapper.findAll('[data-testid="sommaire-resultat"]')
    expect(propositions[0].attributes('data-cible')).toBe('ui-alerts_enabled')

    await champ.trigger('keydown', { key: 'Enter' })
    await flush()

    expect(wrapper.find('details#group-interface').attributes('open')).toBe('')
    expect(wrapper.find('details#ui-config-panel').attributes('open')).toBe('')
    expect(document.activeElement?.id).toBe('ui-alerts_enabled')
    // Le champ se vide, sinon la liste masquerait le sommaire au retour.
    expect((champ.element as HTMLInputElement).value).toBe('')

    wrapper.unmount()
  })

  // La bascule doit SURVIVRE à ce qu'elle escamote : dans le sommaire,
  // elle disparaîtrait avec lui et rien ne permettrait de le rouvrir.
  it('escamote et rétablit le sommaire, la bascule restant atteignable', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    const bascule = () => wrapper.find('#admin-sommaire-bascule')
    expect(bascule().attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#admin-sommaire').exists()).toBe(true)

    await bascule().trigger('click')
    await flush()
    expect(wrapper.find('#admin-sommaire').exists()).toBe(false)
    expect(bascule().exists()).toBe(true)
    expect(bascule().attributes('aria-expanded')).toBe('false')
    // Et la préférence est retenue d'une visite à l'autre.
    expect(localStorage.getItem('docsearch-admin-sommaire-hidden')).toBe('1')

    await bascule().trigger('click')
    await flush()
    expect(wrapper.find('#admin-sommaire').exists()).toBe(true)
  })

  it('rouvre le sommaire escamoté quand on le cherche avec « / »', async () => {
    document.body.innerHTML = ''
    localStorage.setItem('docsearch-admin-sommaire-hidden', '1')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()
    expect(wrapper.find('#admin-sommaire').exists()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    await flush()
    expect(wrapper.find('#admin-sommaire').exists()).toBe(true)
    expect(document.activeElement?.id).toBe('sommaire-recherche')

    wrapper.unmount()
  })

  it('bascule le sommaire sur « s »', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    await flush()
    expect(wrapper.find('#admin-sommaire').exists()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    await flush()
    expect(wrapper.find('#admin-sommaire').exists()).toBe(true)
  })

  it('donne le focus à la ligne de recherche sur « / »', async () => {
    document.body.innerHTML = ''
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    await flush()
    expect(document.activeElement?.id).toBe('sommaire-recherche')

    // Et la touche ne se déclenche pas pendant une saisie : « / » est un
    // caractère comme un autre dans un motif de filtre. L'événement part
    // du champ — c'est ce que fait le navigateur, et c'est sa cible que
    // regarde le composable.
    const champ = wrapper.find('#new-pattern')
    ;(champ.element as HTMLInputElement).focus()
    champ.element.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    await flush()
    expect(document.activeElement?.id).toBe('new-pattern')

    wrapper.unmount()
  })

  // /admin.html#ui-alerts_enabled : c'est ce qui permet à l'aide
  // administrateur de renvoyer vers un réglage plutôt que vers la page.
  it('ouvre le panneau visé par l’ancre de l’URL', async () => {
    document.body.innerHTML = ''
    localStorage.setItem('docsearch-admin-collapsed-groups', '["group-interface"]')
    localStorage.setItem('docsearch-admin-collapsed-panels', '["ui-config-panel"]')
    history.replaceState(null, '', '/admin.html#ui-alerts_enabled')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()

    expect(wrapper.find('details#group-interface').attributes('open')).toBe('')
    expect(wrapper.find('details#ui-config-panel').attributes('open')).toBe('')

    history.replaceState(null, '', '/admin.html')
    wrapper.unmount()
  })

  // Une ancre qui n'existe pas encore — un tableau pas encore chargé —
  // ne doit pas rendre l'entrée inerte : on atterrit sur son panneau.
  it('se rabat sur le panneau quand l’ancre visée manque', async () => {
    document.body.innerHTML = ''
    localStorage.setItem('docsearch-admin-collapsed-panels', '["scan-panel"]')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()

    const sommaire = wrapper.findComponent({ name: 'SommaireLateral' })
    await sommaire.vm.allerA('ancre-inexistante', 'scan-panel')
    await flush()

    expect(wrapper.find('details#scan-panel').attributes('open')).toBe('')
    wrapper.unmount()
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
      'sommaire-recherche',
      'sommaire-resultats',
      'status-cartes',
      'status-versions',
      'status-versions-titre',
      'allsources-tableau',
      'filesources-tableau',
      'filesources-nouvelle',
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
      'websources-nouvelle',
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

  // « Tout replier » ne connaît que les identifiants listés dans la page ;
  // un panneau ou un groupe ajouté au gabarit sans y être inscrit restait
  // ouvert (cas du groupe « Recherche » et du panneau des doublons). On
  // interroge donc le DOM plutôt que ces listes : le test ne peut pas
  // manquer ce que le gabarit affiche.
  it('replie vraiment TOUS les panneaux et groupes affichés', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    const plies = () =>
      wrapper.findAll('details.ds-panel-block').filter((d) => d.attributes('open') !== undefined)
    const total = wrapper.findAll('details.ds-panel-block').length
    expect(total).toBeGreaterThan(15) // 15 panneaux + 6 groupes
    expect(plies()).toHaveLength(total)

    await wrapper.find('#admin-tout-replier').trigger('click')
    await flush()
    expect(plies().map((d) => d.attributes('id'))).toEqual([])

    // Et le bouton bascule bien vers « Tout déplier ».
    expect(wrapper.find('#admin-tout-replier').text()).toContain('Tout déplier')
    await wrapper.find('#admin-tout-replier').trigger('click')
    await flush()
    expect(plies()).toHaveLength(total)
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
    // Le formulaire est une modale téléportée dans <body> : hors du
    // sous-arbre monté, donc hors de portée de `wrapper.find`.
    // L'identifiant est celui que nous passons — s'il venait à manquer,
    // DsfrModal en tirerait un au sort et cette recherche échouerait.
    const modale = new DOMWrapper(document.body)
    expect(modale.find('#modale-source-sql').exists()).toBe(true)

    // Une source neuve s'ouvre déjà avec une ligne de mapping vierge :
    // deux clics en font donc trois, pas deux.
    await modale.find('#sql-colonne-ajouter').trigger('click')
    await modale.find('#sql-colonne-ajouter').trigger('click')
    await flush()
    expect(modale.findAll('[data-testid="sql-colonne"]')).toHaveLength(3)
    for (const i of [0, 1, 2]) {
      expect(modale.find(`#sql-facet-${i}`).exists(), `sql-facet-${i}`).toBe(true)
    }

    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })

  // La création d'une source web est passée en modale, et son refus de
  // validation avec elle : posé dans le bandeau du panneau, il resterait
  // DERRIÈRE la modale — pour l'utilisateur, le bouton ne ferait rien.
  it('garde dans sa modale le refus de la nouvelle source web', async () => {
    document.body.innerHTML = ''
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    await wrapper.find('#websources-nouvelle').trigger('click')
    await flush()
    const modale = new DOMWrapper(document.body)
    expect(modale.find('#modale-source-web').exists()).toBe(true)

    await modale.find('#websources-ajouter').trigger('click')
    await flush()
    expect(modale.find('#websources-formulaire-erreur').text()).toContain('sont requis')
    // La modale reste ouverte : la saisie est encore là, à corriger.
    expect(modale.find('#modale-source-web').exists()).toBe(true)
    expect(idsDupliques(wrapper)).toEqual([])

    // Une fois les trois champs requis renseignés, elle se referme.
    await modale.find('#new-web-name').setValue('cc_decisions')
    await modale.find('#new-web-crawlindex').setValue('crawl-cc')
    await modale.find('#new-web-esindex').setValue('cc_decisions')
    await modale.find('#websources-ajouter').trigger('click')
    await flush()
    expect(document.body.querySelector('#modale-source-web')).toBeNull()

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

  it('garde les cartes d’état affichées pendant un rechargement', async () => {
    // « Recharger » remonte les panneaux pour les recharger, ce qui vidait
    // aussi l'état des composants : sur un écran de supervision, des
    // voyants qui s'éteignent puis se rallument se lisent comme une panne.
    // Le panneau d'état est donc hors du conteneur remonté et se
    // rafraîchit sur place — d'où l'absence de `flush` avant le contrôle,
    // qui vise justement l'instant où la requête est en vol.
    document.body.innerHTML = ''
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    const cartes = wrapper.findAll('[data-testid="status-carte"]').length
    expect(cartes).toBeGreaterThan(0)

    await wrapper.find('#admin-recharger').trigger('click')
    expect(wrapper.findAll('[data-testid="status-carte"]')).toHaveLength(cartes)

    await flush()
    expect(wrapper.findAll('[data-testid="status-carte"]')).toHaveLength(cartes)
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
