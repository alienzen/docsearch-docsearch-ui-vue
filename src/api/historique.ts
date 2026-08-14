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
 * Efface l'historique de recherche de l'utilisateur courant, en
 * ANONYMISANT ses recherches au journal de l'installation.
 *
 * ⚠️ Irréversible, et pas un simple masquage : l'API ôte des recherches
 * passées le compte et l'adresse IP (voir `history_purge.py`). Le texte
 * cherché, les résultats, les avis et les groupes restent au journal
 * pour les statistiques — un groupe décrit un service, pas quelqu'un —
 * mais plus rien n'y nomme leur auteur.
 *
 * ⚠️ Emporte aussi « Vos derniers documents consultés » pour la période
 * antérieure : les clics sont enregistrés DANS le document de leur
 * recherche. L'écran qui appelle cette fonction doit annoncer les deux —
 * une confirmation qui tait ce qu'elle détruit ne confirme rien.
 */
export function purgerRecherchesRecentes(): Promise<{ purged_at: string }> {
  return api<{ purged_at: string }>('/me/searches', { method: 'DELETE' })
}

/**
 * Efface « Vos derniers documents consultés ».
 *
 * ⚠️ Irréversible aussi, mais par SUPPRESSION et non par anonymisation :
 * le détail des clics antérieurs — quel document, quand, à quelle
 * position — est ôté du journal, seul leur nombre y reste (voir
 * `history_purge.py`). Anonymiser aurait emporté les recherches, dont
 * les clics font partie ; supprimer ne coûte que ce qui est demandé.
 * L'écran doit le dire aussi précisément que l'autre.
 */
export function purgerDocumentsRecents(): Promise<{ purged_at: string }> {
  return api<{ purged_at: string }>('/me/recent-documents', { method: 'DELETE' })
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
