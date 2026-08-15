import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useUiConfigStore } from '@/stores/uiConfig'

// Entrées de menu apportées par un module complémentaire (lot 4 de
// PLAN-PLUGINS.md). Le composant testé est un fragment de SearchPage,
// reproduit ici : monter la page entière exigerait Elasticsearch, l'API
// et la moitié du store, pour éprouver six lignes de rendu.
//
// Ce qui compte n'est pas l'apparence mais la RÈGLE : le cœur ne rend que
// ce que le contrat a validé — un libellé, un chemin, une classe DSFR —
// et jamais du HTML ou du script venu d'un module.

const Nav = {
  template: `<ul><li v-for="e in uiConfig.config.plugin_nav" :key="e.chemin" class="fr-nav__item">
    <a class="fr-nav__link" :class="e.icone ? \`fr-link--icon-left \${e.icone}\` : undefined"
       :href="e.chemin" data-testid="lien-module">{{ e.libelle }}</a></li></ul>`,
  setup() {
    return { uiConfig: useUiConfigStore() }
  },
}

function monter(plugin_nav: unknown[]) {
  setActivePinia(createPinia())
  const store = useUiConfigStore()
  store.config.plugin_nav = plugin_nav as never
  return mount(Nav)
}

describe('entrées de menu des modules complémentaires', () => {
  it('n’affiche rien sans module', () => {
    expect(monter([]).findAll('[data-testid="lien-module"]')).toHaveLength(0)
  })

  it('affiche le libellé et le chemin déclarés', () => {
    const w = monter([
      { module: 'assistant', libelle: 'Assistant', chemin: '/ext/assistant/', icone: null },
    ])
    const lien = w.find('[data-testid="lien-module"]')
    expect(lien.text()).toBe('Assistant')
    expect(lien.attributes('href')).toBe('/ext/assistant/')
  })

  it('pose l’icône comme une classe, jamais comme du contenu', () => {
    const w = monter([
      { module: 'a', libelle: 'A', chemin: '/ext/a/', icone: 'fr-icon-chat-3-line' },
    ])
    expect(w.find('[data-testid="lien-module"]').classes()).toContain('fr-icon-chat-3-line')
  })

  it('rend le libellé en TEXTE, sans interpréter de balise', () => {
    // Le contrat interdit déjà bien plus que ça à l'installation ; ce
    // test verrouille la seconde barrière, celle du rendu — c'est elle
    // qui tient si un jour une entrée arrive par un autre chemin.
    const w = monter([
      { module: 'x', libelle: '<img src=x onerror=alert(1)>', chemin: '/ext/x/', icone: null },
    ])
    expect(w.find('[data-testid="lien-module"]').element.innerHTML).not.toContain('<img')
  })
})
