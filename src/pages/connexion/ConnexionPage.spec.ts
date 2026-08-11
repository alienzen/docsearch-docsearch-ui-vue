import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import ConnexionPage from './ConnexionPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { idsDupliques } from '@/test/ids'

// Les éléments optionnels du bas de l'écran (liens de démarche, jalon
// ProConnect) sont pilotés par /ui-config : ils n'existent que si
// l'administration les a renseignés, et une URL douteuse ne doit pas
// atterrir dans un href. C'est ce que couvrent ces tests.

function reponses(uiConfig: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const chemin = url.split('?')[0]
    // Ni session à reprendre, ni SSO : la page tombe sur le formulaire.
    if (chemin === '/auth/refresh') return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })
    if (chemin === '/auth/login/kerberos')
      return Promise.resolve({ ok: false, status: 501, json: () => Promise.resolve({}) })
    if (chemin === '/ui-config') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(uiConfig) })
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
  })
}

async function monter(uiConfig: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', reponses(uiConfig))
  const wrapper = mount(ConnexionPage, {
    global: { plugins: [createPinia()], components: { VIcon, RouterLink: RouterLinkShim } },
  })
  for (let i = 0; i < 8; i++) await nextTick()
  return wrapper
}

describe('ConnexionPage — éléments optionnels', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  })

  it('affiche le formulaire seul quand rien n’est configuré', async () => {
    const wrapper = await monter()
    expect(wrapper.find('#identifiant').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Pas encore de compte')
    expect(wrapper.text()).not.toContain('Mot de passe oublié')
    expect(wrapper.text()).not.toContain('ProConnect')
  })

  it('affiche les deux liens de démarche vers les URL configurées', async () => {
    const wrapper = await monter({
      login_inscription_url: 'https://intranet.exemple.fr/demande-de-compte',
      login_mot_de_passe_oublie_url: '/portail/mot-de-passe',
    })
    const liens = wrapper.findAll('a.fr-link')
    const hrefs = liens.map((l) => l.attributes('href'))
    expect(hrefs).toContain('https://intranet.exemple.fr/demande-de-compte')
    expect(hrefs).toContain('/portail/mot-de-passe')
    expect(wrapper.text()).toContain("Pas encore de compte ? Faire une demande d'inscription")
    expect(wrapper.text()).toContain('Mot de passe oublié ?')
  })

  it('refuse une URL qui n’est ni http(s) ni un chemin interne', async () => {
    const wrapper = await monter({
      // eslint-disable-next-line no-script-url
      login_inscription_url: 'javascript:alert(1)',
      // Chemin protocole-relatif : c'est un domaine externe déguisé.
      login_mot_de_passe_oublie_url: '//evil.example/reset',
    })
    expect(wrapper.text()).not.toContain('Pas encore de compte')
    expect(wrapper.text()).not.toContain('Mot de passe oublié')
  })

  it('pose les identifiants attendus, y compris à travers les composants DSFR', async () => {
    // `DsfrButton` n'a PAS de prop `id` : l'attribut retombe sur son
    // `<button>` racine. `DsfrAlert`, lui, a une prop `id`. Deux
    // mécanismes différents pour le même résultat attendu — d'où ce test,
    // qui échouerait si l'un des deux cessait de fonctionner.
    const wrapper = await monter({
      login_inscription_url: '/inscription',
      login_mot_de_passe_oublie_url: '/mot-de-passe',
      login_proconnect_enabled: true,
    })
    for (const id of [
      'connexion-titre',
      'formulaire-connexion',
      'identifiant',
      'mot-de-passe',
      'connexion-valider',
      'connexion-inscription',
      'connexion-mot-de-passe-oublie',
      'connexion-proconnect',
    ]) {
      expect(wrapper.find(`#${id}`).exists(), id).toBe(true)
    }
    // L'identifiant du bouton doit être porté par le <button> lui-même,
    // pas par un conteneur : c'est lui qu'on clique.
    expect(wrapper.find('#connexion-valider').element.tagName).toBe('BUTTON')
  })

  it('identifie le bandeau d’erreur de saisie', async () => {
    const wrapper = await monter()
    // Le bandeau n'existe qu'après un échec : le poser sans erreur
    // reviendrait à tester une branche morte.
    expect(wrapper.find('#connexion-erreur').exists()).toBe(false)

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Identifiant ou mot de passe incorrect.' }),
        }),
      ),
    )
    await wrapper.find('#formulaire-connexion').trigger('submit')
    for (let i = 0; i < 8; i++) await nextTick()

    expect(wrapper.find('#connexion-erreur').exists()).toBe(true)
  })

  it('n’expose que des identifiants uniques', async () => {
    // Tous les éléments optionnels activés à la fois : c'est la variante
    // la plus fournie de la page, donc la plus exposée à une collision.
    document.body.innerHTML = ''
    const wrapper = await monter({
      login_inscription_url: 'https://intranet.exemple.fr/demande-de-compte',
      login_mot_de_passe_oublie_url: '/portail/mot-de-passe',
      login_proconnect_enabled: true,
    })
    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })

  it('affiche le jalon ProConnect désactivé quand il est activé', async () => {
    const wrapper = await monter({ login_proconnect_enabled: true })
    const bouton = wrapper.findAll('button').find((b) => b.text().includes('ProConnect'))
    expect(bouton).toBeDefined()
    expect(bouton!.attributes('disabled')).toBeDefined()
  })
})
