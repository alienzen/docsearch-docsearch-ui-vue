import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import ChatPage from './ChatPage.vue'
import RouterLinkShim from '@/components/RouterLinkShim.vue'
import { SUGGESTIONS } from './suggestions'
import { idsDupliques } from '@/test/ids'

// Test de fumée : monter la page suffit à détecter une boucle de rendu
// (le test dépasse alors son délai au lieu de figer un onglet en
// recette). Deux boucles de ce genre sont déjà passées inaperçues à la
// relecture pendant cette migration — d'où ce garde-fou.
//
// `fetch` est remplacé, et rien d'autre : c'est l'ENTRÉE de la page, pas
// sa logique. Le module qui répond a ses propres tests (dépôt
// docsearch-plugin-assistant), dont celui qui vérifie que la recherche
// est bien faite au nom de l'utilisateur.

const REPONSE = {
  answer: [
    { text: 'Le document le plus proche de votre question est ' },
    { text: 'Budget prévisionnel 2024', strong: true },
    { text: '.' },
  ],
  sources: ['Budget prévisionnel 2024'],
  total: 3,
}

function repondre(corps: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => corps,
    }),
  )
}

function mountPage() {
  return mount(ChatPage, {
    global: {
      plugins: [createPinia()],
      components: { VIcon, RouterLink: RouterLinkShim },
    },
  })
}

/** Monte la page, pose la première suggestion, attend la réponse. */
async function poserUneQuestion() {
  const wrapper = mountPage()
  await nextTick()
  await wrapper.findAll('[data-testid="chat-suggestion"]')[0].trigger('click')
  await nextTick()
  await nextTick()
  await nextTick()
  return wrapper
}

describe('ChatPage', () => {
  beforeEach(() => repondre(REPONSE))
  afterEach(() => vi.unstubAllGlobals())

  it('se monte sans boucle de rendu', () => {
    expect(mountPage().html()).toBeTruthy()
  })

  it('annonce des réponses extraites, et non rédigées', () => {
    // Ce bandeau est ce qui empêche de lire des extraits comme une
    // synthèse : le module n'a aucun modèle de langage derrière lui.
    expect(mountPage().text()).toContain('Réponses extraites de vos documents')
  })

  it('affiche le message d’accueil', async () => {
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.text()).toContain('Posez votre question en français')
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

  it('interroge le module sous /ext/, avec le cookie de session', async () => {
    // Le chemin compte : /ext/ est proxifié par les deux nginx.conf ET
    // déclaré dans API_ROUTES de vite.config.ts. Le viser à côté produit
    // un 404 qui ne se voit qu'en conteneur.
    await poserUneQuestion()
    // On CHERCHE l'appel plutôt que de prendre le premier : la page en
    // fait d'autres au montage (/ui-config, /is-admin), et leur ordre
    // n'est pas la propriété testée ici.
    const appels = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const appel = appels.find(([u]) => String(u).startsWith('/ext/'))
    expect(appel, `aucun appel /ext/ parmi ${appels.map(([u]) => u).join(', ')}`).toBeTruthy()
    const [url, options] = appel!
    expect(url).toBe('/ext/assistant/ask')
    expect(options.credentials).toBe('same-origin')
    expect(JSON.parse(options.body).question).toBe(SUGGESTIONS[0])
  })

  it('marque chaque bulle de la conversation, et son locuteur', async () => {
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.findAll('[data-testid="chat-message"]')).toHaveLength(1)

    await wrapper.findAll('[data-testid="chat-suggestion"]')[0].trigger('click')
    await nextTick()
    const bulles = wrapper.findAll('[data-testid="chat-message"]')
    expect(bulles).toHaveLength(3)
    expect(bulles.map((m) => m.attributes('data-role'))).toEqual(['ai', 'user', 'ai'])
  })

  it('remplace la bulle d’attente par la réponse du module', async () => {
    const wrapper = await poserUneQuestion()
    // Toujours trois bulles — la bulle d'attente est REMPLACÉE, pas
    // complétée par une quatrième — et plus d'attente en cours.
    expect(wrapper.findAll('[data-testid="chat-message"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="chat-attente"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Budget prévisionnel 2024')
    expect(wrapper.text()).toContain('Sources :')
  })

  it('dit clairement que le module n’est pas installé', async () => {
    // 404 = aucun fragment nginx ne route /ext/assistant/. Ce n'est pas
    // une panne à réessayer, c'est un module à installer — et la
    // recherche classique, elle, marche toujours.
    repondre({}, 404)
    const wrapper = await poserUneQuestion()
    expect(wrapper.text()).toContain("L'assistant n'est pas disponible")
    expect(wrapper.text()).toContain('recherche classique')
  })

  it('invite à se reconnecter quand la session a expiré', async () => {
    repondre({}, 401)
    const wrapper = await poserUneQuestion()
    expect(wrapper.text()).toContain('session a expiré')
  })

  it('n’expose que des identifiants uniques', async () => {
    // Contrôle mené APRÈS un échange complet, et pas sur la page nue :
    // la conversation est le seul `v-for` de cette page qui grossit, donc
    // le seul endroit où un `id` littéral pourrait se dédoubler.
    document.body.innerHTML = ''
    const wrapper = await poserUneQuestion()
    expect(idsDupliques(wrapper)).toEqual([])
    wrapper.unmount()
  })
})
