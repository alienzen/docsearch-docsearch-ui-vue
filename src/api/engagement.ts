import { api } from './client'

/** Pouce haut/bas sur une recherche. */
export function submitFeedback(searchId: string, rating: 'up' | 'down'): Promise<unknown> {
  return api('/feedback', {
    method: 'POST',
    body: JSON.stringify({ search_id: searchId, rating }),
  })
}

/**
 * Tracking de clic sur un résultat — toujours actif, sans bascule
 * d'administration (signal passif, contrairement au pouce et au NPS).
 *
 * Volontairement « fire-and-forget » : ne doit jamais retarder ni
 * bloquer l'ouverture de la fiche du document, ni remonter d'erreur.
 */
export function trackClick(searchId: string | null, docId: string, position: number): void {
  if (!searchId) return
  api('/click', {
    method: 'POST',
    body: JSON.stringify({ search_id: searchId, doc_id: docId, position }),
  }).catch(() => {})
}

export function submitNps(score: number): Promise<unknown> {
  return api('/nps', { method: 'POST', body: JSON.stringify({ score }) })
}

export type SuggestionCategory = 'idea' | 'bug' | 'other'

export function submitSuggestion(
  text: string,
  category: SuggestionCategory,
  anonymous: boolean,
): Promise<unknown> {
  return api('/suggestions', {
    method: 'POST',
    body: JSON.stringify({ text, category, anonymous }),
  })
}
