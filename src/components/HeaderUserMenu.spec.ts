import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HeaderUserMenu from './HeaderUserMenu.vue'
import { useUiConfigStore } from '@/stores/uiConfig'

// Ce menu remplace deux entrées de `quickLinks` qui tenaient une place
// considérable dans .fr-header__tools-links. Ce qui se teste ici, c'est
// ce qui n'est PAS purement visuel : qui le voit, ce que le bouton laisse
// filtrer selon les bascules d'affichage, et le fait que la déconnexion
// reste un lien plein page vers la page de connexion.

function monter(family: 'search' | 'admin' = 'search', links: Lien[] = []) {
  return mount(HeaderUserMenu, { props: { family, links } })
}

type Lien = { label: string; href: string; icon: string; current?: boolean }

/** Utilisateur authentifié, tel que /is-admin le renseigne. */
function connecte(groups: string[] = ['DOCSEARCH_USERS']) {
  useUiConfigStore().currentUser = { user: 'dupont', groups }
}

describe('HeaderUserMenu', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('ne rend rien pour un visiteur anonyme', () => {
    const w = monter()
    expect(w.find('button').exists()).toBe(false)
  })

  it('replie le nom et les groupes derrière un bouton', () => {
    connecte(['DOCSEARCH_USERS', 'DOCSEARCH_ADMINS'])
    const w = monter()

    // Le bouton ne porte que le nom : c'est le suffixe des groupes qui
    // débordait de l'en-tête, il reste dans le menu.
    expect(w.get('button').text()).toBe('dupont')
    expect(w.get('.ds-header__account-user').text()).toBe(
      'Connecté : dupont · DOCSEARCH_USERS, DOCSEARCH_ADMINS',
    )
    expect(w.get('a').attributes('href')).toBe('/connexion?deconnexion=1')
  })

  it('ouvre et referme le menu au clic', async () => {
    connecte()
    const w = monter()
    const bouton = w.get('button')
    const menu = w.get('.fr-menu')

    expect(bouton.attributes('aria-expanded')).toBe('false')
    expect(menu.classes()).not.toContain('fr-collapse--expanded')
    // Le menu est bien celui que déclare le bouton : sans quoi
    // aria-expanded ne renseigne sur rien.
    expect(bouton.attributes('aria-controls')).toBe(menu.attributes('id'))

    await bouton.trigger('click')
    expect(bouton.attributes('aria-expanded')).toBe('true')
    expect(menu.classes()).toContain('fr-collapse--expanded')

    await bouton.trigger('click')
    expect(menu.classes()).not.toContain('fr-collapse--expanded')
  })

  it('tait le nom quand le badge est désactivé, sans retirer la déconnexion', () => {
    const uiConfig = useUiConfigStore()
    connecte()
    uiConfig.config.show_current_user_enabled = false

    const w = monter()
    // La bascule veut dire « ne pas afficher qui est connecté » : ni le
    // bouton ni le menu ne doivent laisser filtrer le nom.
    expect(w.get('button').text()).toBe('Mon compte')
    expect(w.find('.ds-header__account-user').exists()).toBe(false)
    expect(w.text()).not.toContain('dupont')
    expect(w.get('a').attributes('href')).toBe('/connexion?deconnexion=1')
  })

  it('range les liens fournis au-dessus de la déconnexion', () => {
    connecte()
    const w = monter('search', [
      { label: 'Statistiques', href: '/stats.html', icon: 'fr-icon-bar-chart-line' },
      { label: 'Administration', href: '/admin.html', icon: 'fr-icon-settings-5-line' },
    ])

    const liens = w.findAll('.fr-menu__list a')
    expect(liens.map((a) => a.attributes('href'))).toEqual([
      '/stats.html',
      '/admin.html',
      // La déconnexion reste en dernier : c'est l'action terminale du
      // menu, et le filet de séparation la suppose en bas.
      '/connexion?deconnexion=1',
    ])
    expect(liens[0].classes()).toContain('fr-icon-bar-chart-line')
  })

  it('marque la page où l’on se trouve déjà', () => {
    connecte()
    const w = monter('admin', [
      { label: 'Statistiques', href: '/stats.html', icon: 'fr-icon-bar-chart-line', current: true },
      { label: 'Administration', href: '/admin.html', icon: 'fr-icon-settings-5-line' },
    ])

    const liens = w.findAll('.fr-menu__list a')
    expect(liens[0].attributes('aria-current')).toBe('page')
    // Et surtout pas `aria-current="false"` sur les autres, que le DSFR
    // stylerait comme l'entrée courante.
    expect(liens[1].attributes('aria-current')).toBeUndefined()
  })

  it("n'ajoute rien quand la page ne fournit aucun lien", () => {
    connecte()
    const w = monter()
    expect(w.findAll('.fr-menu__list a')).toHaveLength(1)
  })

  it('suit les bascules propres à la famille de pages', () => {
    const uiConfig = useUiConfigStore()
    connecte()
    // Masqué côté recherche, gardé côté administration — où il sert à
    // vérifier sous quelle identité on agit.
    uiConfig.config.show_current_user_enabled = false
    uiConfig.config.show_current_user_groups_enabled_admin = false

    const w = monter('admin')
    expect(w.get('button').text()).toBe('dupont')
    expect(w.get('.ds-header__account-user').text()).toBe('Connecté : dupont')
  })
})
