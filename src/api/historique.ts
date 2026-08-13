import { api } from './client'
import type { SearchResult } from './types'

/**
 * Historique de recherche personnel et suggestions de saisie.
 *
 * Les deux routes lisent le même journal côté API (`search_logs`, écrit à
 * chaque recherche depuis toujours) et ne rendent JAMAIS que ce que
 * l'appelant a lui-même cherché : l'identité vient de son jeton de
 * session, elle n'est pas un paramètre. Voir `user_history.py`.
 */

/** Une recherche passée, dédoublonnée par son texte. */
export type RechercheRecente = {
  query: string
  /** Nombre de fois où cette même recherche a été lancée. */
  count: number
  /** Date ISO de la dernière occurrence. */
  last: string | null
}

/**
 * Nature d'une suggestion — elle décide de l'icône et du libellé de
 * section, et distingue « ce que j'ai déjà cherché » de « ce qui existe
 * dans le corpus », qui ne se valent pas.
 *
 * `custom` couvre TOUTES les facettes personnalisées des sources SQL
 * (« Bureau », « Fonction »…) plutôt qu'une valeur par facette : leur
 * liste est configurée, pas connue à la compilation. C'est `field` qui
 * dit de laquelle il s'agit.
 */
export type NatureSuggestion = 'history' | 'author' | 'keyword' | 'custom'

export type Suggestion = {
  text: string
  kind: NatureSuggestion
  count?: number
  /**
   * Champ ES de la facette — présent pour `custom` seulement, et
   * indispensable : sans lui, l'interface saurait qu'il faut cocher une
   * facette mais pas laquelle.
   */
  field?: string
  /** Libellé de cette facette (« Bureau »), tel que l'API le connaît. */
  label?: string
}

export function listerRecherchesRecentes(limite = 10): Promise<{ searches: RechercheRecente[] }> {
  return api<{ searches: RechercheRecente[] }>(`/me/searches?limit=${limite}`)
}

/**
 * `signal` est indispensable, pas décoratif : l'appel part à chaque
 * frappe, et sans annulation une réponse lente pour « bud » peut arriver
 * après celle de « budget » et réafficher les suggestions d'avant.
 */
export function suggerer(saisie: string, signal?: AbortSignal): Promise<{ suggestions: Suggestion[] }> {
  // Sous /search/ — préfixe déjà proxifié par les deux Nginx et par le
  // proxy de développement, et qui évite le voisinage avec /suggestions
  // (le recueil des suggestions d'amélioration, tout autre chose).
  return api<{ suggestions: Suggestion[] }>(
    `/search/suggest?q=${encodeURIComponent(saisie)}`,
    { signal },
  )
}

/**
 * Les derniers documents ouverts par l'utilisateur courant.
 *
 * Les identifiants viennent des clics déjà journalisés, mais les
 * DOCUMENTS sont relus par l'API à travers l'ACL : un document dont les
 * droits ont changé depuis la consultation, ou supprimé de l'index, n'est
 * pas rendu. Un historique ne rouvre pas une porte qui s'est fermée.
 */
export function listerDocumentsRecents(limite = 6): Promise<{ documents: SearchResult[] }> {
  return api<{ documents: SearchResult[] }>(`/me/recent-documents?limit=${limite}`)
}
