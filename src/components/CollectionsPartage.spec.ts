import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CollectionsPanel from './CollectionsPanel.vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import type { Collection } from '@/api/collections'

// Ce qui se vérifie ici : qu'une collection reçue en partage se
// distingue d'une collection à soi, et qu'on ne propose pas à son
// destinataire des commandes qui échoueraient — écrire reste au
// propriétaire, le destinataire duplique.
//
// Le filtrage des documents par les droits se joue côté API ; ici, c'est
// l'HONNÊTETÉ DE L'AFFICHAGE qui est en jeu : deux personnes ouvrant la
// même collection n'y voient pas forcément le même nombre de documents,
// et l'écart doit être dit.

function collection(partiel: Partial<Collection> = {}): Collection {
  return {
    id: 'c1',
    name: 'Dossier Client X',
    doc_ids: ['a', 'b'],
    shared_with: [],
    owner: 'alice',
    owned: true,
    ...partiel,
  }
}

function stubFetch(collections: Collection[]) {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(collections) })
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('CollectionsPanel — partage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useUiConfigStore().config.collections_shared_enabled = true
  })

  it('propose le partage sur ses propres collections', async () => {
    stubFetch([collection(), collection({ id: 'c2', name: 'À lire' })])
    const w = mount(CollectionsPanel)
    await flushPromises()

    expect(w.findAll('[data-testid="collection-partager"]')).toHaveLength(2)
    expect(w.findAll('[data-testid="collection-dupliquer"]')).toHaveLength(0)
  })

  it('ne propose pas le partage quand l’administration l’a désactivé', async () => {
    useUiConfigStore().config.collections_shared_enabled = false
    stubFetch([collection(), collection({ id: 'c2' })])
    const w = mount(CollectionsPanel)
    await flushPromises()

    expect(w.findAll('[data-testid="collection-partager"]')).toHaveLength(0)
    // Supprimer reste possible : c'est sa collection.
    expect(w.findAll('[data-testid="collection-supprimer"]')).toHaveLength(2)
  })

  // Une collection reçue surgirait de nulle part dans le menu si rien ne
  // disait d'où elle vient.
  it('dit de qui vient une collection reçue, et n’en propose que la copie', async () => {
    stubFetch([
      collection({ owned: false, owner: 'alice.admin', shared_with: ['finance'] }),
      collection({ id: 'c2', name: 'À lire' }),
    ])
    const w = mount(CollectionsPanel)
    await flushPromises()

    const texte = w.text()
    expect(texte).toContain('partagée par alice.admin')
    expect(w.findAll('[data-testid="collection-dupliquer"]')).toHaveLength(1)
    // Ni supprimer ni partager sur celle des autres.
    expect(w.findAll('[data-testid="collection-supprimer"]')).toHaveLength(1)
    expect(w.findAll('[data-testid="collection-partager"]')).toHaveLength(1)
  })

  it('annonce ses propres partages', async () => {
    stubFetch([collection({ shared_with: ['finance', 'direction'] }), collection({ id: 'c2' })])
    const w = mount(CollectionsPanel)
    await flushPromises()

    expect(w.text()).toContain('partagée avec finance, direction')
  })
})
