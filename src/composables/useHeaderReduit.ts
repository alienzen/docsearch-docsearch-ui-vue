import { onBeforeUnmount, toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import { useScrolled } from './useScrolled'

/**
 * Classe posée sur l'élément racine, où app.css la lit
 * (`:root.ds-header-reduit .fr-header__brand-top`…).
 *
 * Sur la racine et non sur le <header> : celui-ci est rendu par
 * DsfrHeader, qui n'expose pas de classe conditionnelle sur son élément
 * racine. Même cible que la variable CSS de useHeaderHeight(), qui
 * publie la hauteur de l'en-tête au même endroit.
 */
const CLASSE = 'ds-header-reduit'

/**
 * Réduction établie au-delà de 120 px, relâchée seulement sous 40 px.
 * Deux seuils et non un seul : l'en-tête est dans le flux, le replier
 * remonte le contenu, et une position pile sur une limite unique ferait
 * battre l'état.
 */
const SEUIL_REDUCTION = 120
const SEUIL_RETOUR = 40

/**
 * Replie la partie décorative de l'en-tête — bloc-marque, logo
 * opérateur, baseline — dès que la page défile, et la rétablit en haut
 * de page. Le repli lui-même est décrit dans app.css, et ne vaut qu'à
 * partir de 62em : en deçà, le DSFR range déjà l'en-tête derrière un
 * burger et un bouton loupe.
 *
 * `actif` est réactif à dessein : il vaut le drapeau d'administration
 * `header_shrink_enabled`, qui n'arrive qu'avec la réponse de
 * /ui-config, APRÈS le montage de la page. Un simple `if` à
 * l'installation le manquerait. Son extinction en cours de défilement
 * rétablit donc aussi l'en-tête complet.
 */
export function useHeaderReduit(actif: MaybeRefOrGetter<boolean>) {
  const { scrolled } = useScrolled(SEUIL_REDUCTION, SEUIL_RETOUR)

  watchEffect(() => {
    document.documentElement.classList.toggle(CLASSE, toValue(actif) && scrolled.value)
  })

  // Les pages sont montées une par une par le build multipage, mais les
  // tests montent et démontent en série dans un même document : sans ce
  // retrait, la classe survivrait à la page qui l'a posée.
  onBeforeUnmount(() => document.documentElement.classList.remove(CLASSE))
}
