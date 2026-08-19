import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import StatsPage from './StatsPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { idsDupliques } from '@/test/ids'
import { SECTIONS } from './sections'

// Même garde-fou que ChatPage : monter la page détecte une boucle de
// rendu (dépassement de délai) et vérifie que les six panneaux se
// peuplent. Le bandeau « Accès refusé » est testé à part, car c'est le
// comportement qui protège la page d'un utilisateur non habilité.

/** Réponses minimales mais réalistes des six endpoints /admin/*. */
const RESPONSES: Record<string, unknown> = {
  '/admin/search-logs/summary': {
    total_searches: 2736,
    // Supérieur au total : la différence est le nombre de tours de page,
    // que le total écarte et que la mention d'assiette des temps compte.
    total_logged: 2801,
    unique_users: 7,
    unique_ips: 3,
    by_day: [
      { date: '2026-07-16', count: 168 },
      { date: '2026-07-17', count: 205 },
    ],
    feedback_up: 7,
    feedback_down: 4,
    // Les ventilations par groupe manquaient : `StatsGroupCounts` et les
    // tableaux « par groupe » n'étaient donc jamais rendus, et le contrôle
    // d'unicité ne voyait rien de ce que ce composant produit — alors
    // qu'il est instancié TROIS fois dans la page.
    by_group: [
      { group: 'docsearch-users', searches: 2000, feedback_up: 5, feedback_down: 2 },
      { group: '__sans_groupe__', searches: 736, feedback_up: 2, feedback_down: 2 },
    ],
    searches_by_group: [
      { group: 'docsearch-users', count: 2000 },
      { group: '__sans_groupe__', count: 736 },
    ],
    // `measured` volontairement inférieur à `total_logged` : c'est le
    // cas durable (les recherches d'avant la mesure n'ont pas de durée),
    // et celui qui doit faire apparaître la mention de l'assiette.
    timing: {
      avg_ms: 143.2,
      p50_ms: 96,
      p95_ms: 812,
      took_avg_ms: 41.7,
      slow_count: 12,
      slow_threshold_ms: 2000,
      measured: 1490,
    },
  },
  '/admin/nps-summary': {
    total_responses: 2,
    nps_score: 0,
    detractors: 1,
    passives: 0,
    promoters: 1,
    by_group: [
      {
        group: 'docsearch-users',
        responses: 1,
        detractors: 0,
        passives: 0,
        promoters: 1,
        nps_score: 100,
      },
      {
        group: '__sans_groupe__',
        responses: 1,
        detractors: 1,
        passives: 0,
        promoters: 0,
        nps_score: -100,
      },
    ],
  },
  // ⚠️ DEUX entrées par liste, jamais une seule : c'est ce qui permet au
  // contrôle d'unicité des identifiants de démontrer quelque chose. Avec
  // une entrée, un `id` littéral posé dans un `v-for` ne se dédouble
  // jamais et le contrôle passe au vert sans rien vérifier.
  '/admin/suggestions': {
    total: 2,
    results: [
      {
        id: 's1',
        timestamp: '2026-07-20T10:00:00Z',
        text: 'Ajouter un tri par pertinence',
        category: 'idea',
        status: 'nouveau',
        username: null,
      },
      {
        id: 's2',
        timestamp: '2026-07-21T09:00:00Z',
        text: 'Exporter en CSV',
        category: 'idea',
        status: 'nouveau',
        username: 'bob.user',
      },
    ],
    by_group: [
      { group: 'docsearch-users', count: 1 },
      { group: '__sans_groupe__', count: 1 },
    ],
  },
  '/admin/search-logs/zero-results': {
    total_zero_result_searches: 12,
    results: [
      {
        query: 'xyzzy',
        count: 3,
        last_seen: '2026-07-20T10:00:00Z',
        criteres: [{ champ: 'extension', valeur: '.pdf', count: 2 }],
        sans_critere: 1,
      },
      {
        query: 'plugh',
        count: 1,
        last_seen: '2026-07-21T08:00:00Z',
        criteres: [],
        sans_critere: 1,
      },
    ],
    by_group: [
      { group: 'docsearch-users', count: 3 },
      { group: '__sans_groupe__', count: 1 },
    ],
  },
  '/admin/search-logs': {
    total: 2,
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
      {
        id: 'l2',
        timestamp: '2026-07-21T11:00:00Z',
        username: 'bob.user',
        query: 'note de service',
        total_results: 12,
        result_files: ['e.pdf'],
        extension: ['.pdf'],
        source: ['documents'],
        feedback: null,
      },
    ],
  },
  '/admin/audit-log': {
    total: 2,
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
      {
        id: 'a2',
        timestamp: '2026-07-21T12:00:00Z',
        username: 'alice.admin',
        method: 'POST',
        path: '/admin/ui-config',
        path_params: {},
        body: { footer_enabled: true },
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

/**
 * `attachTo` seulement pour les tests qui regardent le focus : il ne
 * s'établit que sur un élément réellement dans le document, et attacher
 * systématiquement laisserait le corps du document jonché entre les
 * tests.
 */
function mountPage(attachTo?: HTMLElement) {
  return mount(StatsPage, {
    attachTo,
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

  it('pose un identifiant distinct sur chacun des trois pagineurs', async () => {
    // Le cas qui justifie la prop `id` de StatsPager : trois instances
    // dans la même page. Un identifiant écrit en dur dans le composant
    // s'y retrouverait en triple, et `label for` / `aria-controls` ne
    // désigneraient plus que le premier.
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    for (const id of ['suggestions-pagination', 'logs-pagination', 'audit-log-pagination']) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
      expect(wrapper.find(`#${id}-precedent`).element.tagName, id).toBe('BUTTON')
      expect(wrapper.find(`#${id}-suivant`).element.tagName, id).toBe('BUTTON')
    }
  })

  it('pose les identifiants des zones des panneaux', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    for (const id of [
      'stats-outils',
      'stats-sommaire-bascule',
      'stats-tout-replier',
      'sommaire-recherche',
      'sommaire-resultats',
      'summary-cartes',
      'summary-histogramme',
      'summary-groupes',
      'summary-avis-groupes',
      'nps-cartes',
      'nps-groupes',
      'suggestions-tableau',
      'suggestions-groupes',
      'zero-results-tableau',
      'zero-results-groupes',
      'logs-filtres',
      'logs-filtrer',
      'logs-reinitialiser',
      'logs-export',
      'logs-tableau',
      'audit-log-tableau',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
  })

  it('marque chaque ligne répétée d’un data-testid', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()
    // Une marque par ligne, et autant de lignes que d'entrées
    // bouchonnées : c'est ce qui distingue une accroche posée sur la
    // boucle d'une accroche posée par erreur sur le conteneur.
    expect(wrapper.findAll('[data-testid="summary-jour"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="summary-avis-groupe"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="nps-groupe"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="suggestion-ligne"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="suggestion-statut"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="zero-result-ligne"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="log-ligne"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="audit-ligne"]')).toHaveLength(2)
    // Trois tableaux « par groupe » de deux lignes chacun.
    expect(wrapper.findAll('[data-testid="groupe-ligne"]')).toHaveLength(6)
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

  // sections.ts est la source du sommaire, du bouton « Tout replier » et
  // des raccourcis chiffrés : ce qu'elle déclare doit être EXACTEMENT ce
  // que le gabarit rend, dans le même ordre. C'est ce contrôle qui rend
  // la duplication des titres acceptable.
  it('rend exactement les panneaux déclarés dans sections.ts', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    // Le premier nœud texte du <summary> seulement : le sous-titre le
    // suit dans un <small>, et `text()` recollerait les deux.
    const rendus = wrapper.findAll('details.ds-panel-block').map((d) => ({
      id: d.attributes('id'),
      titre: d.find('summary').element.childNodes[0]?.textContent?.trim(),
    }))
    expect(rendus).toEqual(SECTIONS.map((s) => ({ id: s.id, titre: s.titre })))
  })

  it('liste tous les panneaux dans le sommaire', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    expect(wrapper.findAll('[data-testid="sommaire-section"]').map((a) => a.text())).toEqual(
      SECTIONS.map((s) => s.titre),
    )
    // Un seul niveau sur cette page : chaque section EST un panneau.
    expect(wrapper.findAll('[data-testid="sommaire-panneau"]')).toHaveLength(0)
  })

  // Le geste que le sommaire doit rendre possible : taper ce dont on se
  // souvient et atterrir SUR la commande, panneau replié compris.
  it('mène de la recherche du sommaire au lien d’export, panneau replié compris', async () => {
    document.body.innerHTML = ''
    localStorage.setItem('docsearch-stats-collapsed-panels', '["logs-panel"]')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()

    expect(wrapper.find('details#logs-panel').attributes('open')).toBeUndefined()

    const champ = wrapper.find('#sommaire-recherche')
    await champ.setValue('export')
    const propositions = wrapper.findAll('[data-testid="sommaire-resultat"]')
    expect(propositions[0].attributes('data-cible')).toBe('logs-export')

    await champ.trigger('keydown', { key: 'Enter' })
    await flush()

    expect(wrapper.find('details#logs-panel').attributes('open')).toBe('')
    expect(document.activeElement?.id).toBe('logs-export')
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

    const bascule = () => wrapper.find('#stats-sommaire-bascule')
    expect(bascule().attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#stats-sommaire').exists()).toBe(true)

    await bascule().trigger('click')
    await flush()
    expect(wrapper.find('#stats-sommaire').exists()).toBe(false)
    expect(bascule().exists()).toBe(true)
    expect(bascule().attributes('aria-expanded')).toBe('false')
    // La préférence est la même que sur l'administration : escamoter la
    // colonne est un choix de mise en page, pas l'état d'un panneau.
    expect(localStorage.getItem('docsearch-admin-sommaire-hidden')).toBe('1')

    await bascule().trigger('click')
    await flush()
    expect(wrapper.find('#stats-sommaire').exists()).toBe(true)
  })

  it('rouvre le sommaire escamoté quand on le cherche avec « / »', async () => {
    document.body.innerHTML = ''
    localStorage.setItem('docsearch-admin-sommaire-hidden', '1')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()
    expect(wrapper.find('#stats-sommaire').exists()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }))
    await flush()
    expect(wrapper.find('#stats-sommaire').exists()).toBe(true)
    expect(document.activeElement?.id).toBe('sommaire-recherche')

    wrapper.unmount()
  })

  it('bascule le sommaire sur « s »', async () => {
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage()
    await flush()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    await flush()
    expect(wrapper.find('#stats-sommaire').exists()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
    await flush()
    expect(wrapper.find('#stats-sommaire').exists()).toBe(true)
  })

  // /stats.html#logs-export : c'est ce qui permet à l'aide de renvoyer
  // vers une commande précise plutôt que vers la page entière.
  it('ouvre le panneau visé par l’ancre de l’URL', async () => {
    document.body.innerHTML = ''
    localStorage.setItem('docsearch-stats-collapsed-panels', '["logs-panel"]')
    history.replaceState(null, '', '/stats.html#logs-export')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()

    expect(wrapper.find('details#logs-panel').attributes('open')).toBe('')

    history.replaceState(null, '', '/stats.html')
    wrapper.unmount()
  })

  // Une ancre qui n'existe pas encore — un tableau pas encore chargé —
  // ne doit pas rendre l'entrée inerte : on atterrit sur son panneau.
  it('se rabat sur le panneau quand l’ancre visée manque', async () => {
    document.body.innerHTML = ''
    localStorage.setItem('docsearch-stats-collapsed-panels', '["nps-panel"]')
    vi.stubGlobal('fetch', respondWith())
    const wrapper = mountPage(document.body)
    await flush()

    const sommaire = wrapper.findComponent({ name: 'SommaireLateral' })
    await sommaire.vm.allerA('ancre-inexistante', 'nps-panel')
    await flush()

    expect(wrapper.find('details#nps-panel').attributes('open')).toBe('')
    wrapper.unmount()
  })

  // Le sommaire disparaît avec les panneaux : sans eux, il n'y a plus
  // une seule section à sommairiser.
  it('remplace la page par un bandeau unique en cas de refus d’accès', async () => {
    // Un 403 vaut pour les six panneaux : mieux vaut un message clair
    // que six erreurs identiques empilées.
    vi.stubGlobal('fetch', respondWith(403))
    const wrapper = mountPage()
    await flush()
    expect(wrapper.text()).toContain('Accès refusé')
    expect(wrapper.text()).not.toContain("Journal d'audit")
    expect(wrapper.find('#stats-sommaire').exists()).toBe(false)
  })
})
