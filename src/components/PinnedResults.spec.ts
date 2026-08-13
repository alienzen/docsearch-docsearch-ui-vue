import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultsList from './ResultsList.vue'
import { useSearchStore } from '@/stores/search'
import type { SearchResult } from '@/api/types'

// Ce qui se vérifie ici : qu'un document mis en avant par
// l'administration est AFFICHÉ COMME TEL. Un classement forcé en
// silence est une mauvaise surprise le jour où quelqu'un s'en aperçoit —
// et ce jour arrive.
//
// Le filtrage par les droits, lui, se joue côté API (voir
// tests/test_epingles.py) : l'interface ne reçoit que ce que
// l'utilisateur a le droit de voir.

function resultat(id: string, pinned = false): SearchResult {
  return {
    id,
    score: pinned ? null : 1,
    highlight: [],
    filename: `${id}.pdf`,
    filepath: `/documents/${id}.pdf`,
    // Le drapeau que l'API pose sur un document épinglé — il voyage dans
    // le résultat, il ne doit pas se retrouver à l'écran.
    ...(pinned ? { pinned: true } : {}),
  }
}

function monter() {
  return mount(ResultsList, { global: { stubs: { DsfrPagination: true, DsfrAlert: true } } })
}

describe('ResultsList — résultats épinglés', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  it('affiche les épinglés sous une mention explicite', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.total = 2
    store.results = [resultat('naturel')]
    store.pinnedResults = [resultat('epingle', true)]

    const w = monter()

    expect(w.find('#resultats-epingles').exists()).toBe(true)
    expect(w.find('#resultats-epingles').text()).toContain(
      'Résultats mis en avant pour votre recherche',
    )
    expect(w.findAll('[data-testid="resultat-epingle"]')).toHaveLength(1)
  })

  // La mention en tête de bloc ne suit pas la carte : elle se perd dès
  // qu'on fait défiler, et rien ne dirait alors qu'on regarde un
  // document désigné plutôt qu'un résultat classé. Le badge et le liseré
  // voyagent avec la carte — et le badge dit en toutes lettres ce que le
  // liseré ne dit qu'en couleur.
  it('marque chaque carte épinglée, et ne marque pas les autres', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.total = 2
    store.results = [resultat('naturel')]
    store.pinnedResults = [resultat('epingle', true)]

    const w = monter()

    const epinglee = w.find('[data-testid="resultat-epingle"]')
    expect(epinglee.find('[data-testid="carte-resultat-epingle"]').text()).toBe('Mis en avant')
    expect(epinglee.classes()).toContain('ds-result--epingle')

    const naturelle = w.find('[data-testid="carte-resultat"]')
    expect(naturelle.find('[data-testid="carte-resultat-epingle"]').exists()).toBe(false)
    expect(naturelle.classes()).not.toContain('ds-result--epingle')
  })

  it('n’affiche aucune mention quand rien n’est épinglé', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.total = 1
    store.results = [resultat('naturel')]

    expect(monter().find('#resultats-epingles').exists()).toBe(false)
  })

  // Un épinglé n'a pas été classé, il a été désigné : l'API lui met
  // `score: null` et `pinned: true`. La carte affichait l'un comme un
  // score de 0 % — le pire de la page, sur le document mis en avant — et
  // l'autre comme une métadonnée de source, « Pinned : true ».
  it('n’affiche ni score ni drapeau technique sur un épinglé', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.total = 0
    store.pinnedResults = [resultat('epingle', true)]

    const carte = monter().find('[data-testid="resultat-epingle"]')

    expect(carte.text()).not.toContain('%')
    expect(carte.text()).not.toContain('Pinned')
  })

  // Cas réel : la requête ne ramène rien par elle-même, mais
  // l'administration a désigné un document. L'écran doit le montrer, pas
  // afficher « aucun résultat » par-dessus.
  it('montre un épinglé même sans résultat naturel', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.total = 0
    store.results = []
    store.pinnedResults = [resultat('epingle', true)]

    const w = monter()

    expect(w.findAll('[data-testid="resultat-epingle"]')).toHaveLength(1)
    expect(w.find('#resultats-vides').exists()).toBe(false)
  })
})
