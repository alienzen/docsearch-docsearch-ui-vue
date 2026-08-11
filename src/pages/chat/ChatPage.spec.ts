import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import ChatPage from './ChatPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { SUGGESTIONS } from './cannedResponses'
import { idsDupliques } from '@/test/ids'

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

  it('pose les identifiants des zones de la page', async () => {
    const wrapper = mountPage()
    await nextTick()
    for (const id of [
      'main-content',
      'chat-avertissement',
      'chat-conversation',
      'chat-suggestions',
      'chat-saisie',
      'chat-question',
      'chat-envoyer',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
    expect(wrapper.find('#chat-envoyer').element.tagName).toBe('BUTTON')
    // Une suggestion marquée par élément, pas une pour la liste entière.
    expect(wrapper.findAll('[data-testid="chat-suggestion"]')).toHaveLength(SUGGESTIONS.length)
  })

  it('marque chaque bulle de la conversation, et son locuteur', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountPage()
      await nextTick()
      // Au départ : le seul message d'accueil, côté assistant.
      expect(wrapper.findAll('[data-testid="chat-message"]')).toHaveLength(1)

      await wrapper.findAll('[data-testid="chat-suggestion"]')[0].trigger('click')
      await nextTick()
      // Pendant l'attente : accueil + question + bulle en cours.
      const enAttente = wrapper.findAll('[data-testid="chat-message"]')
      expect(enAttente).toHaveLength(3)
      expect(enAttente.map((m) => m.attributes('data-role'))).toEqual(['ai', 'user', 'ai'])
      expect(wrapper.findAll('[data-testid="chat-attente"]')).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(2000)
      await nextTick()
      // Après réponse : toujours trois bulles — la bulle d'attente est
      // REMPLACÉE, pas complétée par une quatrième — et plus d'attente.
      expect(wrapper.findAll('[data-testid="chat-message"]')).toHaveLength(3)
      expect(wrapper.findAll('[data-testid="chat-attente"]')).toHaveLength(0)
      expect(wrapper.findAll('[data-testid="chat-source"]').length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('n’expose que des identifiants uniques', async () => {
    // Contrôle mené APRÈS un échange complet, et pas sur la page nue :
    // la conversation est le seul `v-for` de cette page qui grossit, donc
    // le seul endroit où un `id` littéral pourrait se dédoubler.
    document.body.innerHTML = ''
    vi.useFakeTimers()
    try {
      const wrapper = mountPage()
      await nextTick()
      await wrapper.findAll('[data-testid="chat-suggestion"]')[0].trigger('click')
      await vi.advanceTimersByTimeAsync(2000)
      await nextTick()
      expect(idsDupliques(wrapper)).toEqual([])
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('répond à une suggestion et remplace la bulle d’attente', async () => {
    // La réponse est différée pour imiter un temps de réflexion : sans
    // faux minuteurs, le test attendrait réellement plus d'une seconde.
    vi.useFakeTimers()
    try {
      const wrapper = mountPage()
      await nextTick()
      await wrapper.findAll('[data-testid="chat-suggestion"]')[0].trigger('click')
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
