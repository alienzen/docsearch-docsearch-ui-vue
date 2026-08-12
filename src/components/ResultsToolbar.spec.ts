import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultsToolbar from './ResultsToolbar.vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiConfigStore } from '@/stores/uiConfig'

// Ces tests portent sur la seule vraie logique de l'affichage du temps de
// recherche : sa double condition. La bascule d'administration AUTORISE
// la fonctionnalité pour toute l'installation, la préférence locale
// décide de l'afficher ou non — et le bouton qui règle cette préférence
// ne doit exister que là où il sert à quelque chose.

function monter() {
  return mount(ResultsToolbar, {
    global: {
      stubs: { DsfrSelect: true, DsfrButton: true, DsfrAlert: true },
    },
  })
}

/** Une recherche aboutie, avec sa mesure. */
function rechercheFaite(timing: { took_ms: number | null; duration_ms: number } | null = {
  took_ms: 43,
  duration_ms: 187.7,
}) {
  const store = useSearchStore()
  store.hasSearched = true
  store.total = 12
  store.timing = timing
  return store
}

describe('ResultsToolbar — temps de recherche', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('n’affiche rien tant que l’administration ne l’a pas autorisé', () => {
    rechercheFaite()
    // Défaut de l'installation : la bascule est à false.
    const w = monter()

    expect(w.find('#resultats-duree').exists()).toBe(false)
    // Pas de bouton non plus : proposer de masquer ce qui n'est pas
    // affiché n'aurait aucun sens.
    expect(w.find('#resultats-duree-bascule').exists()).toBe(false)
  })

  it('affiche la durée une fois la bascule activée', () => {
    rechercheFaite()
    useUiConfigStore().config.search_time_enabled = true

    const w = monter()
    expect(w.find('#resultats-duree').text()).toBe('en 188 ms')
  })

  it('masque la durée si l’utilisateur l’a refusée, sans retirer le bouton', () => {
    rechercheFaite()
    useUiConfigStore().config.search_time_enabled = true
    usePreferencesStore().showSearchTime = false

    const w = monter()
    expect(w.find('#resultats-duree').exists()).toBe(false)
    // Le bouton doit rester : c'est le seul moyen de la faire revenir.
    expect(w.find('#resultats-duree-bascule').exists()).toBe(true)
  })

  // Cas d'une API antérieure à la mesure : la bascule est active mais il
  // n'y a rien à montrer. Un bouton « Afficher le temps » qui n'affiche
  // rien serait pire que pas de bouton du tout.
  it('n’affiche ni durée ni bouton quand l’API n’en renvoie pas', () => {
    rechercheFaite(null)
    useUiConfigStore().config.search_time_enabled = true

    const w = monter()
    expect(w.find('#resultats-duree').exists()).toBe(false)
    expect(w.find('#resultats-duree-bascule').exists()).toBe(false)
  })

  it('détaille moteur et traitement au survol', () => {
    rechercheFaite()
    useUiConfigStore().config.search_time_enabled = true

    const titre = monter().find('#resultats-duree').attributes('title') || ''
    expect(titre).toContain('43 ms')
    expect(titre).toContain('188 ms')
  })
})
