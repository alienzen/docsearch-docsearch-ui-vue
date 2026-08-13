import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import SearchPage from './SearchPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { useSearchStore } from '@/stores/search'
import { useSelectionStore } from '@/stores/selection'
import { idsDupliques } from '@/test/ids'

// La page de recherche est celle qui concentre les éléments répétés —
// cartes de résultat, puces de facette, entrées des menus de l'en-tête.
// C'est donc là qu'un `id` littéral posé dans un `v-for` se dédouble en
// premier, et c'est la raison d'être de ce fichier.
//
// ⚠️ DEUX entrées partout, jamais une seule : avec un seul résultat ou un
// seul seau de facette, une duplication ne se manifeste jamais et le
// contrôle passe au vert sans rien vérifier.

const RESPONSES: Record<string, unknown> = {
  '/ui-config': {
    footer_enabled: true,
    collections_enabled: true,
    alerts_enabled: true,
    chat_enabled: true,
    show_current_user_enabled: true,
  },
  '/is-admin': { is_admin: true, user: 'alice.admin', groups: ['docsearch-admins'] },
  '/engagement-config': { feedback_enabled: true, nps_enabled: false, suggestions_enabled: true },
  '/searchable-sources': [
    { name: 'documents', label: 'Documents', type: 'file', collectable: true },
    { name: 'agents', label: 'Agents', type: 'sql', collectable: false },
  ],
  '/custom-facets': { bureau: 'Bureau', telephone: 'Téléphone' },
  '/saved-searches': [
    { id: 'r1', name: 'Rapports 2026', query: 'rapport', alert_enabled: true, alert_frequency: 'daily' },
    { id: 'r2', name: 'Notes de service', query: 'note', alert_enabled: false },
  ],
  '/collections': [
    { id: 'c1', name: 'À lire', doc_ids: ['d1', 'd2'] },
    { id: 'c2', name: 'Archivé', doc_ids: ['d3'] },
  ],
  '/alerts': [
    {
      saved_search_id: 'r1',
      saved_search_name: 'Rapports 2026',
      new_count: 3,
      checked_at: '2026-08-09T08:00:00Z',
      seen: false,
    },
    {
      saved_search_id: 'r2',
      saved_search_name: 'Notes de service',
      new_count: 1,
      checked_at: '2026-08-08T08:00:00Z',
      seen: true,
    },
  ],
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

/** Deux résultats, et deux seaux dans chacune des facettes. */
function peupler() {
  const store = useSearchStore()
  store.query = 'rapport'
  store.hasSearched = true
  store.total = 2
  // Un filtre actif et un document coché : sans eux, ni ActiveFilters ni
  // SelectionToolbar ne se rendent, et leurs identifiants ne seraient
  // jamais éprouvés.
  store.ext = ['.pdf']
  // La barre d'avis se rattache à l'identifiant de recherche rendu par
  // l'API : sans lui, elle ne s'affiche pas du tout.
  store.searchId = 'rech-1'
  useSelectionStore().set('d1', true)
  store.results = [
    {
      id: 'd1',
      score: 1.2,
      highlight: ['un <mark>rapport</mark> annuel'],
      filename: 'rapport-2026.pdf',
      title: 'Rapport annuel 2026',
      extension: '.pdf',
      author: 'alice.admin',
      keywords: ['budget', 'annuel'],
      source: 'documents',
      folder: 'rapports',
      filepath: '/rapports/rapport-2026.pdf',
      date_modified: '2026-07-01T10:00:00Z',
      size: 120000,
    },
    {
      id: 'd2',
      score: 0.8,
      highlight: ['note de <mark>service</mark>'],
      filename: 'note-42.docx',
      title: 'Note de service 42',
      extension: '.docx',
      author: 'bob.user',
      keywords: ['rh'],
      source: 'documents',
      folder: 'notes',
      filepath: '/notes/note-42.docx',
      date_modified: '2026-07-15T10:00:00Z',
      size: 34000,
    },
  ]
  store.facets = {
    extensions: [
      { key: '.pdf', doc_count: 1 },
      { key: '.docx', doc_count: 1 },
    ],
    authors: [
      { key: 'alice.admin', doc_count: 1 },
      { key: 'bob.user', doc_count: 1 },
    ],
    keywords: [
      { key: 'budget', doc_count: 1 },
      { key: 'rh', doc_count: 1 },
    ],
    folders: [
      { key: 'rapports', doc_count: 1 },
      { key: 'notes', doc_count: 1 },
    ],
    sources: [
      { key: 'documents', doc_count: 2 },
      { key: 'agents', doc_count: 0 },
    ],
    custom: {
      bureau: {
        label: 'Bureau',
        buckets: [
          { key: 'Paris', doc_count: 1 },
          { key: 'Lyon', doc_count: 1 },
        ],
      },
    },
  }
  return store
}

async function flush() {
  for (let i = 0; i < 10; i++) await nextTick()
}

/**
 * ⚠️ `attachTo: document.body` n'est pas un détail de confort. Les
 * contrôles d'en-tête (présélection des sources, réinitialisation) sont
 * TÉLÉPORTÉS vers `.fr-header__search`, que la page cherche au montage
 * avec `document.querySelector`. Sur un composant monté détaché — le
 * défaut de vue-test-utils — cette recherche rend `null`, le `v-if` de la
 * téléportation reste faux, et ces contrôles n'existent tout simplement
 * pas dans le rendu. Le test le croirait alors absent du code.
 *
 * Corollaire : vider `document.body` AVANT de monter, sinon les pages des
 * tests précédents s'y accumulent et faussent le contrôle d'unicité.
 */
async function monter() {
  document.body.innerHTML = ''
  vi.stubGlobal('fetch', respondWith())
  const pinia = createPinia()
  setActivePinia(pinia)
  peupler()
  const wrapper = mount(SearchPage, {
    attachTo: document.body,
    global: { plugins: [pinia], components: { VIcon, RouterLink: RouterLinkShim } },
  })
  await flush()
  return wrapper
}

describe('SearchPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    // jsdom n'implémente pas ResizeObserver, dont `useHeaderHeight` se
    // sert pour caler la colonne de facettes sous l'en-tête collant. Il
    // ne s'installait pas tant que la page était montée détachée, faute
    // de trouver son `<header>` ; il s'installe désormais.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  it('se monte sans boucle de rendu', async () => {
    vi.stubGlobal('fetch', respondWith())
    setActivePinia(createPinia())
    const wrapper = mount(SearchPage, {
      global: { plugins: [createPinia()], components: { VIcon, RouterLink: RouterLinkShim } },
    })
    await flush()
    expect(wrapper.html()).toBeTruthy()
  })

  it('rend enfin identifiables les sections de facettes', async () => {
    // `FacetSection` avait le même défaut que `CollapsiblePanel` avant le
    // lot 0 : sa prop `id` servait de clé de persistance du pli sans
    // jamais atteindre le DOM. Les six sections étaient donc invisibles à
    // toute automatisation.
    const wrapper = await monter()
    for (const id of [
      'facet-extensions',
      'facet-sources',
      'facet-authors',
      'facet-keywords',
      'facet-folders',
      'facet-custom-bureau',
      'facet-dates',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
      expect(wrapper.find(`#${id}`).element.tagName, id).toBe('DETAILS')
    }
    // La case d'une valeur de facette garde son identifiant suffixé, qui
    // lie le <label for> : les deux cohabitent sans se marcher dessus.
    // Sélecteur d'ATTRIBUT et non `#...` : l'identifiant contient un
    // point, que la syntaxe CSS lirait comme le début d'une classe.
    expect(wrapper.find('[id="facet-extensions-.pdf"]').exists()).toBe(true)
  })

  it('pose les identifiants des zones de la page', async () => {
    const wrapper = await monter()
    for (const id of [
      'recherche',
      'outils-entete',
      'recherche-reinitialiser',
      'recherche-enregistrer',
      'sources',
      'sources-bouton',
      'facettes-entete',
      'facettes-tout-replier',
      'facettes-poignee',
      'facet-dates-appliquer',
      'filtres-actifs',
      'filtres-effacer-tout',
      'selection',
      'selection-ajouter-collection',
      'selection-annuler',
      'resultats',
      'resultats-outils',
      'resultats-decompte',
      'filtres-bascule',
      'resultats-tri',
      'resultats-vue-compacte',
      'avis',
      'avis-utile',
      'avis-peu-utile',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
  })

  it('coupe la saisie mémorisée du navigateur sur la barre de recherche', async () => {
    // Attribut posé sur l'input rendu par DsfrHeader, faute de prop qui
    // l'atteigne : c'est la liste native du navigateur qui recouvrait
    // sinon les suggestions de SearchSuggestions.
    //
    // La barre du modal mobile relève du même mécanisme, mais son cas —
    // apparition APRÈS le montage — se teste dans
    // composables/useAutocompleteOff.spec.ts : l'ouvrir ici demanderait
    // de déclencher le modal de vue-dsfr, dont le piège à focus refuse
    // de s'activer sous jsdom faute d'élément « tabbable » mesurable.
    const wrapper = await monter()
    expect(wrapper.find('#recherche').attributes('autocomplete')).toBe('off')
  })

  it('marque chaque élément répété d’un data-testid', async () => {
    const wrapper = await monter()

    expect(wrapper.findAll('[data-testid="carte-resultat"]')).toHaveLength(2)
    expect(
      wrapper.findAll('[data-testid="carte-resultat"]').map((c) => c.attributes('data-id')),
    ).toEqual(['d1', 'd2'])
    // Six sections de facettes, deux valeurs chacune.
    expect(wrapper.findAll('[data-testid="facette-valeur"]')).toHaveLength(12)
    expect(wrapper.findAll('[data-testid="source-choix"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="recherche-enregistree"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="collection"]')).toHaveLength(2)
    // Les notifications ne sont chargées qu'à l'OUVERTURE du menu :
    // au montage, seul le badge est calculé. Les compter sans ouvrir
    // reviendrait à constater une liste vide et à s'en satisfaire.
    await wrapper.find('#alertes-bouton').trigger('click')
    await flush()
    expect(wrapper.findAll('[data-testid="alerte"]')).toHaveLength(2)
    expect(wrapper.find('#alertes-purger').exists()).toBe(true)
    // Un jeu de boutons de copie par carte pourvue d'un chemin.
    expect(wrapper.findAll('[data-testid="copier-chemin"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="filtre-actif"]').length).toBeGreaterThan(0)
  })

  it('n’expose que des identifiants uniques, résultats et facettes affichés', async () => {
    // Le store est peuplé AVANT le montage, sur la même instance de
    // Pinia que la page : c'est ce qui fait exister la colonne de
    // facettes, que `facetsVisible` conditionne à une recherche déjà
    // faite. Voir monter() pour le rattachement au document.
    const wrapper = await monter()

    // Garde-fou du garde-fou : si la page ne rendait ni résultats ni
    // facettes, l'absence de doublon ne prouverait rien.
    expect(wrapper.text()).toContain('Rapport annuel 2026')
    expect(wrapper.text()).toContain('Note de service 42')

    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })
})
