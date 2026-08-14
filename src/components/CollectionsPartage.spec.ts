import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CollectionsPanel from './CollectionsPanel.vue'
import { useSelectionStore } from '@/stores/selection'
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
    // Les modales sont téléportées dans <body> : sans ça, celles du test
    // précédent y traînent encore.
    document.body.innerHTML = ''
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

  // La couleur ne distingue pas le sens du partage (reçu / donné) : elle
  // dit seulement « cette liste n'est pas qu'à moi », ce que la mention
  // voisine précise. D'où la même classe des deux côtés.
  it('colore le nom des collections partagées, dans les deux sens', async () => {
    stubFetch([
      collection({ id: 'recue', owned: false, owner: 'alice.admin' }),
      collection({ id: 'donnee', shared_with: ['finance'] }),
      collection({ id: 'perso' }),
    ])
    const w = mount(CollectionsPanel)
    await flushPromises()

    const classes = (id: string) =>
      w.get(`[data-id="${id}"] [data-testid="collection-nom"]`).classes()
    expect(classes('recue')).toContain('ds-collection__nom--partagee')
    expect(classes('donnee')).toContain('ds-collection__nom--partagee')
    expect(classes('perso')).not.toContain('ds-collection__nom--partagee')
  })

  // Ajouter un document à une collection partagée en donne la référence
  // au groupe : le choix de la collection est le dernier moment où on
  // peut s'en apercevoir.
  it('signale le partage aussi au moment de choisir une collection', async () => {
    stubFetch([
      collection({ id: 'donnee', shared_with: ['finance'] }),
      collection({ id: 'perso', name: 'À lire' }),
    ])
    useSelectionStore().set('doc-1', true)
    const w = mount(CollectionsPanel)
    await flushPromises()

    await (w.vm as unknown as { openAdd: () => Promise<void> }).openAdd()
    await flushPromises()

    // La modale est téléportée dans <body> : elle n'est pas dans le
    // sous-arbre du composant monté.
    const noms = document.body.querySelectorAll('[data-testid="collection-choix-nom"]')
    expect(noms).toHaveLength(2)
    expect(noms[0].className).toContain('ds-collection__nom--partagee')
    expect(noms[1].className).not.toContain('ds-collection__nom--partagee')
    // La couleur ne suffit pas : la mention doit être lisible telle quelle.
    expect(document.body.textContent).toContain('· partagée')

    w.unmount()
  })

  // L'API refuse l'écriture dans la collection d'un autre (`_get_owned`) :
  // la proposer au choix, c'est promettre un clic qui échoue toujours.
  it('ne propose pas les collections reçues au moment d’ajouter des documents', async () => {
    stubFetch([
      collection({ id: 'recue', name: 'Revue Finance', owned: false, owner: 'alice.admin' }),
      collection({ id: 'perso', name: 'À lire' }),
    ])
    useSelectionStore().set('doc-1', true)
    const w = mount(CollectionsPanel)
    await flushPromises()

    await (w.vm as unknown as { openAdd: () => Promise<void> }).openAdd()
    await flushPromises()

    const noms = [...document.body.querySelectorAll('[data-testid="collection-choix-nom"]')]
    expect(noms.map((n) => n.textContent)).toEqual(['À lire'])

    w.unmount()
  })

  // N'avoir que des collections reçues n'est pas n'avoir aucune
  // collection : le message doit dire lequel des deux, sinon il passe
  // pour un bug — le menu, lui, affiche bien une collection.
  it('distingue « aucune collection » de « aucune collection à soi »', async () => {
    stubFetch([collection({ id: 'recue', owned: false, owner: 'alice.admin' })])
    useSelectionStore().set('doc-1', true)
    const w = mount(CollectionsPanel)
    await flushPromises()

    await (w.vm as unknown as { openAdd: () => Promise<void> }).openAdd()
    await flushPromises()

    const message = document.body.querySelector('[data-testid="collection-picker-vide"]')
    expect(message?.textContent).toContain('Aucune collection à vous')
    // La création reste la porte de sortie.
    expect(document.body.querySelector('[aria-label="Nom de la nouvelle collection"]')).not.toBeNull()

    w.unmount()
  })

  it('garde « Aucune collection pour l’instant. » quand il n’y en a réellement aucune', async () => {
    stubFetch([])
    useSelectionStore().set('doc-1', true)
    const w = mount(CollectionsPanel)
    await flushPromises()

    await (w.vm as unknown as { openAdd: () => Promise<void> }).openAdd()
    await flushPromises()

    const message = document.body.querySelector('[data-testid="collection-picker-vide"]')
    expect(message?.textContent).toContain("Aucune collection pour l'instant.")

    w.unmount()
  })
})
