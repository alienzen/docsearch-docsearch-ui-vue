/**
 * Personnalisation des cartes de résultat par source.
 *
 * Le registre est publié par `public/custom-sources.js`, servi tel quel
 * (hors du bundle) : un administrateur peut donc l'éditer dans le
 * conteneur et recharger la page, sans reconstruire l'application. C'est
 * le contrat qu'offrait déjà docsearch-ui, et la seule raison d'être du
 * dispositif.
 *
 * DÉCLARATIF et non impératif, contrairement au `sourceCardHooks` de
 * docsearch-ui qui recevait un élément du DOM et le modifiait : sous Vue,
 * tout ce qu'un tel hook écrit est écrasé au rendu suivant — changement
 * de page, bascule de vue compacte, dépli d'une carte. Un registre de
 * valeurs lues PENDANT le rendu est idempotent par construction.
 *
 * Le fichier est déposé par l'administrateur, au même niveau de confiance
 * que le code déployé : ses valeurs ne sont pas des saisies utilisateur.
 * Elles restent néanmoins rendues comme du texte par Vue, donc échappées.
 */
export type SourceCardCustom = {
  /** Badge supplémentaire, à droite de l'extension. */
  badge?: string
  /** Préfixe ajouté devant le titre (ex. « [RH] »). */
  titlePrefix?: string
  /** Couleur du liseré gauche de la carte. Toute couleur CSS valide. */
  accent?: string
}

declare global {
  interface Window {
    docsearchSourceCards?: Record<string, SourceCardCustom>
  }
}

/**
 * Réglages d'une source, ou `undefined`. Lu à chaque appel plutôt que
 * mémorisé au chargement du module : le fichier est un script classique,
 * dont rien ne garantit qu'il se soit exécuté avant le premier rendu.
 */
export function sourceCardCustom(source: string | undefined): SourceCardCustom | undefined {
  if (!source) return undefined
  return window.docsearchSourceCards?.[source]
}
