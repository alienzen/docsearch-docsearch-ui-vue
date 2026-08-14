import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import AdminFileSourcesPanel from './AdminFileSourcesPanel.vue'

// La création d'une source est passée en modale. Ce qui se joue ici
// n'est pas l'ouverture — visible au premier essai — mais le sort de la
// SAISIE quand l'enregistrement est refusé : le bandeau d'erreur du
// panneau se retrouverait DERRIÈRE la modale, et le bouton « Ajouter »
// aurait l'air de ne rien faire.

const SOURCES = {
  documents: { es_index: 'documents', folder: '', label: 'Documents' },
  archives: { es_index: 'archives', folder: 'archives', label: 'Archives' },
}

/** Réponses de l'API : la liste au chargement, puis ce qu'on lui dicte. */
function stubFetch(creation: { ok: boolean; detail?: string } = { ok: true }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, options?: { method?: string }) => {
      const creating = (options?.method ?? 'GET') !== 'GET'
      if (!creating) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SOURCES) })
      }
      return Promise.resolve({
        ok: creation.ok,
        status: creation.ok ? 200 : 400,
        json: () => Promise.resolve(creation.ok ? {} : { detail: creation.detail }),
      })
    }),
  )
}

async function monter() {
  const wrapper = mount(AdminFileSourcesPanel, { global: { plugins: [createPinia()] } })
  await flushPromises()
  return wrapper
}

/** La modale est téléportée dans <body>, hors du sous-arbre monté. */
function modale() {
  return new DOMWrapper(document.body)
}

async function ouvrir(wrapper: Awaited<ReturnType<typeof monter>>) {
  await wrapper.get('#filesources-nouvelle').trigger('click')
  await flushPromises()
}

describe('AdminFileSourcesPanel — création en modale', () => {
  beforeEach(() => {
    // Les modales des tests précédents restent dans <body>, faute de
    // démontage : sans ce nettoyage, `modale()` en trouverait plusieurs.
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('garde le refus de validation dans la modale, sans la refermer', async () => {
    stubFetch()
    const wrapper = await monter()
    await ouvrir(wrapper)
    expect(modale().find('#modale-source-fichiers').exists()).toBe(true)

    await modale().get('#filesources-ajouter').trigger('click')
    await flushPromises()

    expect(modale().get('#filesources-formulaire-erreur').text()).toContain('sont requis')
    expect(modale().find('#modale-source-fichiers').exists()).toBe(true)
    wrapper.unmount()
  })

  it('garde de même le refus de l’API, saisie intacte', async () => {
    stubFetch({ ok: false, detail: 'Le nom « finance » est déjà pris.' })
    const wrapper = await monter()
    await ouvrir(wrapper)
    await modale().get('#new-file-name').setValue('finance')
    await modale().get('#new-file-index').setValue('finance_docs')

    await modale().get('#filesources-ajouter').trigger('click')
    await flushPromises()

    expect(modale().get('#filesources-formulaire-erreur').text()).toContain('déjà pris')
    // La saisie refusée est encore là : la refermer obligerait à tout
    // retaper pour corriger un seul champ.
    expect((modale().get('#new-file-name').element as HTMLInputElement).value).toBe('finance')
    wrapper.unmount()
  })

  it('referme la modale quand la source est créée, et prévient les autres panneaux', async () => {
    stubFetch()
    const wrapper = await monter()
    await ouvrir(wrapper)
    await modale().get('#new-file-name').setValue('finance')
    await modale().get('#new-file-index').setValue('finance_docs')

    await modale().get('#filesources-ajouter').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('#modale-source-fichiers')).toBeNull()
    // La liste alimente les sélecteurs des autres panneaux (types de
    // fichiers, filtres, scan) : sans cet événement, ils ignoreraient
    // la source qu'on vient d'ajouter.
    expect(wrapper.emitted('changed')).toBeTruthy()
    wrapper.unmount()
  })

  it('rouvre un formulaire vierge après une saisie abandonnée', async () => {
    stubFetch()
    const wrapper = await monter()
    await ouvrir(wrapper)
    await modale().get('#new-file-name').setValue('brouillon')
    await modale().get('#filesources-annuler').trigger('click')
    await flushPromises()

    await ouvrir(wrapper)

    expect((modale().get('#new-file-name').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
})
