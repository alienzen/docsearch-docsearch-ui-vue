import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import AdminPluginsPanel from './AdminPluginsPanel.vue'

// Ce qui est éprouvé ici n'est pas l'apparence : c'est que le cœur rend
// des CHAMPS TYPÉS à partir d'une déclaration, et jamais du balisage venu
// d'un module — plus l'avertissement sans lequel un réglage enregistré
// passerait pour un réglage appliqué.

const MODULES = {
  jira: {
    enabled: true,
    version: '1.2.0',
    restart_requis: false,
    reglages: { actif: 'true', bureaux: 'Paris,Reims' },
    admin_panel: [
      { cle: 'actif', type: 'booleen', libelle: 'Synchroniser', aide: null, defaut: 'false', variable: 'DOCSEARCH_OPT_ACTIF' },
      { cle: 'bureaux', type: 'liste', libelle: 'Bureaux', aide: null, defaut: '', variable: 'DOCSEARCH_OPT_BUREAUX' },
    ],
  },
}

function repondre(corps: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => corps }),
  )
}

function monter() {
  return mount(AdminPluginsPanel, {
    global: { plugins: [createPinia()], components: { VIcon } },
  })
}

describe('AdminPluginsPanel', () => {
  beforeEach(() => repondre(MODULES))
  afterEach(() => vi.unstubAllGlobals())

  it('se monte sans boucle de rendu', () => {
    expect(monter().html()).toBeTruthy()
  })

  it('rend un champ par réglage déclaré', async () => {
    const w = monter()
    await flushPromises()
    expect(w.text()).toContain('Synchroniser')
    expect(w.text()).toContain('Bureaux')
    expect(w.find('[data-testid="module"]').attributes('data-module')).toBe('jira')
  })

  it('affiche la version du module', async () => {
    const w = monter()
    await flushPromises()
    expect(w.find('[data-testid="module-version"]').text()).toBe('version 1.2.0')
  })

  it('dit « version inconnue » plutôt que de laisser un blanc', async () => {
    // Cas d'un module installé avant que la version soit recopiée dans
    // Redis : un blanc se lirait comme un défaut d'affichage.
    repondre({ jira: { ...MODULES.jira, version: '' } })
    const w = monter()
    await flushPromises()
    expect(w.find('[data-testid="module-version"]').text()).toBe('version inconnue')
  })

  it('dit qu’un module sans réglage n’en déclare aucun', async () => {
    repondre({ vide: { enabled: false, version: '0.1.0', restart_requis: false, reglages: {}, admin_panel: [] } })
    const w = monter()
    await flushPromises()
    expect(w.text()).toContain('ne déclare aucun réglage')
  })

  it('avertit quand les réglages ne sont pas appliqués', async () => {
    // Sans cet avertissement, une valeur enregistrée passerait pour une
    // valeur en vigueur : les variables d'environnement d'un conteneur
    // sont fixées à sa création.
    repondre({ jira: { ...MODULES.jira, restart_requis: true } })
    const w = monter()
    await flushPromises()
    const alerte = w.find('[data-testid="module-redemarrage"]')
    expect(alerte.exists()).toBe(true)
    expect(alerte.text()).toContain('plugin appliquer jira')
  })

  it('n’avertit pas quand tout est appliqué', async () => {
    const w = monter()
    await flushPromises()
    expect(w.find('[data-testid="module-redemarrage"]').exists()).toBe(false)
  })

  it('envoie le jeu COMPLET des réglages', async () => {
    // Un envoi partiel laisserait croire qu'un réglage absent vaut sa
    // valeur par défaut, alors qu'il vaut ce qui était enregistré.
    const w = monter()
    await flushPromises()
    await w.find('[data-testid="module-enregistrer"]').trigger('click')
    await flushPromises()

    const appels = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const envoi = appels.find(([u]) => String(u).includes('/reglages'))
    expect(envoi).toBeTruthy()
    expect(JSON.parse(envoi![1].body).reglages).toEqual({ actif: 'true', bureaux: 'Paris,Reims' })
  })

  it('affiche l’erreur de l’API sans vider l’écran', async () => {
    const w = monter()
    await flushPromises()
    repondre({ detail: 'Réglage non déclaré' }, 400)
    await w.find('[data-testid="module-enregistrer"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="modules-erreur"]').exists()).toBe(true)
    expect(w.text()).toContain('Synchroniser')
  })
})
