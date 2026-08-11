import { describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import NpsModal from './NpsModal.vue'
import ShortcutsModal from './ShortcutsModal.vue'
import SuggestionModal from './SuggestionModal.vue'
import RouterLinkShim from './RouterLinkShim.vue'

/**
 * `DsfrModal` fabrique son identifiant avec `Math.random()` quand on ne
 * lui en donne pas (`modalId: { default: () => …randomId… }` dans
 * `vue-dsfr`) : l'identifiant change alors à chaque rendu, ce qui n'en
 * fait un point d'accroche ni pour l'automatisation ni pour un lien.
 *
 * Ces tests figent le fait que l'identifiant est bien celui que nous
 * passons. Ils tiennent aussi lieu de garde-fou sur le NOM de la prop :
 * c'est `modal-id`, pas `id` — un `id` posé en attribut ne remplacerait
 * pas la valeur tirée au sort, il s'ajouterait ailleurs.
 */
function monter(composant: Component) {
  return mount(composant, {
    props: { opened: true },
    global: { plugins: [createPinia()], components: { VIcon, RouterLink: RouterLinkShim } },
  })
}

const MODALES: [string, Component][] = [
  ['modale-nps', NpsModal],
  ['modale-raccourcis', ShortcutsModal],
  ['modale-suggestion', SuggestionModal],
]

describe('identifiants des modales', () => {
  it.each(MODALES)('%s porte un identifiant stable', (id, composant) => {
    const wrapper = monter(composant)
    expect(wrapper.find(`#${id}`).exists()).toBe(true)
    // Deuxième montage : l'identifiant ne doit pas bouger.
    expect(monter(composant).find(`#${id}`).exists()).toBe(true)
    wrapper.unmount()
  })
})
