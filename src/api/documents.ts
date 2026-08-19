import { api } from './client'
import type { SearchResult } from './types'

/** Fiche complète d'un document (mêmes champs qu'un résultat, plus l'ACL). */
export type DocumentDetail = SearchResult & {
  type?: string
  date_created?: string
  /**
   * Texte extrait du document à l'indexation. Présent ICI seulement :
   * /search l'écarte de ses réponses parce qu'il est volumineux
   * (`source_excludes` côté search_api.py), là où /document/{id} renvoie
   * la source entière. C'est ce qui permet à la fiche de montrer un
   * extrait même ouverte hors recherche.
   */
  content?: string
  acl?: {
    owner?: string
    groups?: string[]
    public?: boolean
  }
}

export function getDocument(id: string): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/document/${id}`)
}

/**
 * Ajoute des mots-clés personnalisés à un document.
 *
 * Plusieurs mots-clés peuvent être saisis d'un coup, séparés par « ; »
 * (même séparateur que l'extraction Tika côté ingestion). Ils sont
 * envoyés UN PAR UN ET SÉQUENTIELLEMENT, jamais en Promise.all :
 * l'API fait un lire-modifier-écrire sur le même document de mots-clés
 * — en parallèle, deux requêtes liraient le même état de départ et la
 * dernière écriture effacerait l'ajout de l'autre.
 */
export async function addKeywords(id: string, raw: string): Promise<void> {
  const keywords = raw
    .split(';')
    .map((k) => k.trim())
    .filter(Boolean)
  for (const keyword of keywords) {
    await api(`/document/${id}/keywords`, {
      method: 'POST',
      body: JSON.stringify({ keyword }),
    })
  }
}

export function removeKeyword(id: string, keyword: string): Promise<unknown> {
  return api(`/document/${id}/keywords/${encodeURIComponent(keyword)}`, { method: 'DELETE' })
}
