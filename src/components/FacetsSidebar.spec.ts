import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FacetsSidebar from './FacetsSidebar.vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import type { SearchFacets } from '@/api/types'

// Ce que /search renvoie quand la recherche ne porte QUE sur l'annuaire
// SQL : les agrégations du schéma fichier sont vides — l'API les calcule
// de toute façon, c'est à l'interface de ne pas en faire des sections.
const FACETTES_SQL: SearchFacets = {
  extensions: [],
  authors: [],
  keywords: [],
  folders: [],
  sources: [{ key: 'agents', doc_count: 2 }],
  custom: {
    bureau: {
      label: 'Bureau',
      buckets: [
        { key: 'Paris', doc_count: 1 },
        { key: 'Lyon', doc_count: 1 },
      ],
    },
  },
  // Aucun agent n'a de `date_modified` : c'est ce compte, et non un seau
  // vide, qui dit à la section « Période » qu'elle n'a rien à filtrer.
  with_date: 0,
}

function monter() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const uiConfig = useUiConfigStore()
  uiConfig.allSources = [
    { name: 'documents', label: 'Documents', type: 'file', collectable: true },
    {
      name: 'agents',
      label: 'Agents',
      type: 'sql',
      collectable: false,
      card_fields: { nom: null, bureau: 'Bureau' },
    },
    // Source portée par un module complémentaire : ni extension ni
    // dossier (le contrat les lui refuse), et une date qui dépend du
    // module, pas du type.
    { name: 'rss_presse', label: 'Presse', type: 'plugin', collectable: true },
  ]
  const store = useSearchStore()
  store.facets = { ...FACETTES_SQL }
  return { wrapper: mount(FacetsSidebar, { global: { plugins: [pinia] } }), store }
}

/** Identifiants des sections de facettes réellement rendues. */
function sections(html: string) {
  return [...html.matchAll(/id="(facet-[\w-]+)"/g)].map((m) => m[1])
}

describe('FacetsSidebar', () => {
  beforeEach(() => localStorage.clear())

  it('affiche toutes les facettes fixes tant qu’aucune source n’est sélectionnée', () => {
    const { wrapper } = monter()
    expect(sections(wrapper.html())).toEqual(
      expect.arrayContaining([
        'facet-extensions',
        'facet-sources',
        'facet-authors',
        'facet-keywords',
        'facet-folders',
        'facet-dates',
      ]),
    )
  })

  it('ne garde que la source et ses facettes propres sur une source SQL', async () => {
    const { wrapper, store } = monter()
    store.source = ['agents']
    await nextTick()

    const rendues = sections(wrapper.html())
    // L'annuaire ne porte ni extension, ni auteur, ni mots-clés, ni
    // dossier, ni date de modification : ces sections n'ont plus lieu
    // d'être, et n'affichent plus « Aucun type »/« Aucun auteur »…
    for (const absente of [
      'facet-extensions',
      'facet-authors',
      'facet-keywords',
      'facet-folders',
      'facet-dates',
    ])
      expect(rendues).not.toContain(absente)
    // La facette « Source » reste : c'est par elle qu'on revient aux
    // autres sources.
    expect(rendues).toContain('facet-sources')
    expect(rendues).toContain('facet-custom-bureau')
  })

  it('garde une facette hors type dès qu’elle a des valeurs à cocher', async () => {
    const { wrapper, store } = monter()
    store.source = ['agents']
    // Index plus ancien que la configuration de la source : le champ
    // n'est plus déclaré, mais les documents le portent encore.
    store.facets = { ...FACETTES_SQL, authors: [{ key: 'alice.admin', doc_count: 2 }] }
    await nextTick()

    expect(sections(wrapper.html())).toContain('facet-authors')
  })

  it('retire type de fichier et dossier sur une source de module', async () => {
    const { wrapper, store } = monter()
    store.source = ['rss_presse']
    // Un module qui pousse des dates (docsearch-plugin-rss depuis sa
    // 0.1.1) : la période, elle, a de quoi filtrer.
    store.facets = { ...FACETTES_SQL, with_date: 12 }
    await nextTick()

    const rendues = sections(wrapper.html())
    expect(rendues).not.toContain('facet-extensions')
    expect(rendues).not.toContain('facet-folders')
    expect(rendues).toContain('facet-dates')
  })

  it('retire la période quand aucun résultat n’est daté', async () => {
    const { wrapper, store } = monter()
    store.source = ['rss_presse']
    // Un module qui n'en pousse pas (docsearch-plugin-annuaire, dont les
    // données ne portent aucune date) : le sélecteur de période aurait
    // vidé l'écran au premier clic, le filtre étant un `range` sur
    // `date_modified`.
    store.facets = { ...FACETTES_SQL, with_date: 0 }
    await nextTick()

    expect(sections(wrapper.html())).not.toContain('facet-dates')
  })

  it('garde la période tant qu’un intervalle est coché, même sans résultat daté', async () => {
    const { wrapper, store } = monter()
    store.source = ['rss_presse']
    store.facets = { ...FACETTES_SQL, with_date: 0 }
    store.dateFrom = '2026-01-01'
    await nextTick()

    // Sans quoi le seul endroit d'où décocher l'intervalle disparaîtrait
    // avec les résultats qu'il vient de faire disparaître.
    expect(sections(wrapper.html())).toContain('facet-dates')
  })

  it('rétablit les facettes fixes dès qu’une source fichier est sélectionnée', async () => {
    const { wrapper, store } = monter()
    store.source = ['agents', 'documents']
    await nextTick()

    expect(sections(wrapper.html())).toEqual(
      expect.arrayContaining([
        'facet-extensions',
        'facet-authors',
        'facet-keywords',
        'facet-folders',
        'facet-dates',
      ]),
    )
  })
})
