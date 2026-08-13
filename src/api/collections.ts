import { api } from './client'

export type Collection = {
  id: string
  name: string
  doc_ids: string[]
  /** Groupes avec qui la collection est partagée (vide = personnelle). */
  shared_with: string[]
  /** Propriétaire — renseigné pour savoir de qui vient une collection reçue. */
  owner: string
  /**
   * Faux sur une collection reçue en partage. Décidé par l'API : l'écran
   * n'a pas à comparer des noms d'utilisateur pour savoir s'il peut
   * modifier.
   */
  owned: boolean
}

// Plusieurs de ces endpoints renvoient la liste complète mise à jour
// plutôt que la seule ressource modifiée : on reprend cette convention
// telle quelle, elle évite un aller-retour de rechargement.

export function listCollections(): Promise<Collection[]> {
  return api<Collection[]>('/collections')
}

export function createCollection(name: string): Promise<Collection> {
  return api<Collection>('/collections', { method: 'POST', body: JSON.stringify({ name }) })
}

export function deleteCollection(id: string): Promise<Collection[]> {
  return api<Collection[]>(`/collections/${id}`, { method: 'DELETE' })
}

export function removeDocument(collectionId: string, docId: string): Promise<Collection[]> {
  return api<Collection[]>(`/collections/${collectionId}/documents/${docId}`, { method: 'DELETE' })
}

/**
 * Ajoute des documents à une collection. Séquentiel pour la même raison
 * que les mots-clés : l'API relit et réécrit la même collection à chaque
 * appel, deux ajouts en parallèle s'écraseraient.
 */
export async function addDocuments(collectionId: string, docIds: string[]): Promise<void> {
  for (const docId of docIds) {
    await api(`/collections/${collectionId}/documents`, {
      method: 'POST',
      body: JSON.stringify({ doc_id: docId }),
    })
  }
}

/**
 * Partage une collection avec des groupes, ou la repasse en personnel
 * (liste vide).
 *
 * ⚠️ Partager donne la RÉFÉRENCE, pas le droit de lecture : chaque
 * document reste relu à travers l'ACL de celui qui regarde. Deux
 * personnes ouvrant la même collection n'y voient donc pas forcément le
 * même nombre de documents, et l'écran le dit plutôt que de masquer
 * l'écart.
 */
export function shareCollection(id: string, groups: string[]): Promise<Collection[]> {
  return api<Collection[]>(`/collections/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ groups }),
  })
}

/** Porte de sortie du destinataire : il ne modifie pas, il recopie. */
export function duplicateCollection(id: string): Promise<Collection[]> {
  return api<Collection[]>(`/collections/${id}/duplicate`, { method: 'POST' })
}
