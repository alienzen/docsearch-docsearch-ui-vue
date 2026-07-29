import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import ChatPage from './ChatPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'

// Test de fumée : monter la page suffit à détecter une boucle de rendu
// (le test dépasse alors son délai au lieu de figer un onglet en
// recette). Deux boucles de ce genre sont déjà passées inaperçues à la
// relecture pendant cette migration — d'où ce garde-fou.

function mountPage() {
  return mount(ChatPage, {
    global: {
      plugins: [createPinia()],
      components: { VIcon, RouterLink: RouterLinkShim },
    },
  })
}

describe('ChatPage', () => {
  it('se monte sans boucle de rendu', () => {
    const wrapper = mountPage()
    expect(wrapper.html()).toBeTruthy()
  })

  it('affiche d’emblée l’avertissement de démonstration', () => {
    // Ce bandeau est la seule chose qui empêche de prendre cet écran
    // pour une fonctionnalité opérationnelle : l'endpoint /ask n'existe
    // pas côté API.
    expect(mountPage().text()).toContain('réponses de démonstration')
  })

  it('affiche le message d’accueil', async () => {
    // Le message est poussé dans onMounted : il faut laisser passer un
    // cycle de rendu avant de lire le texte.
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.text()).toContain("démonstration de l'assistant IA")
  })

  it('propose les suggestions de questions', () => {
    expect(mountPage().text()).toContain('Quels documents parlent du budget 2024 ?')
  })

  it('répond à une suggestion et remplace la bulle d’attente', async () => {
    // La réponse est différée pour imiter un temps de réflexion : sans
    // faux minuteurs, le test attendrait réellement plus d'une seconde.
    vi.useFakeTimers()
    try {
      const wrapper = mountPage()
      await nextTick()
      await wrapper.findAll('.fr-tag')[0].trigger('click')
      await nextTick()
      // Pendant l'attente, une bulle vide tient la place.
      expect(wrapper.text()).toContain('Quels documents parlent du budget 2024 ?')

      await vi.advanceTimersByTimeAsync(2000)
      await nextTick()
      // Et elle doit bien être REMPLACÉE par la réponse : muter l'objet
      // poussé au lieu de le remplacer dans le tableau laissait la bulle
      // bloquée sur « … », sans erreur nulle part.
      expect(wrapper.text()).toContain('Budget prévisionnel 2024')
      expect(wrapper.text()).toContain('Sources :')
    } finally {
      vi.useRealTimers()
    }
  })
})
