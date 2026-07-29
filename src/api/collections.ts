import { api } from './client'

export type Collection = {
  id: string
  name: string
  doc_ids: string[]
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
