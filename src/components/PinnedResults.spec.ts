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
    expect(w.find('#resultats-epingles').text()).toContain('Proposé par votre administration')
    expect(w.findAll('[data-testid="resultat-epingle"]')).toHaveLength(1)
  })

  it('n’affiche aucune mention quand rien n’est épinglé', () => {
    const store = useSearchStore()
    store.hasSearched = true
    store.total = 1
    store.results = [resultat('naturel')]

    expect(monter().find('#resultats-epingles').exists()).toBe(false)
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
