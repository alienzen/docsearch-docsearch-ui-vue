import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Durée du fondu de fermeture d'un menu, en millisecondes.
 *
 * Doit rester supérieure à la transition CSS (0,15 s — voir `.fr-menu`
 * dans app.css) : c'est elle qui décide quand le menu retrouve sa
 * hauteur repliée, et une hauteur ramenée à zéro AVANT la fin du fondu
 * rognerait le menu en plein trajet. Le dépassement se joue une fois le
 * menu déjà invisible, il ne se voit donc pas.
 */
export const DUREE_FERMETURE_MS = 200

/**
 * Marque un menu comme « en cours de fermeture » le temps de son fondu.
 *
 * Le DSFR replie un `.fr-collapse` en lui imposant `max-height: 0`, ce
 * qui escamote son contenu à l'instant où la classe `fr-collapse--expanded`
 * tombe : plus rien à estomper. Sa propre parade est la classe
 * `fr-collapsing`, qu'il pose pendant la transition et qui neutralise
 * cette contrainte (`--collapse-max-height` reste à `none`). Son
 * JavaScript n'étant pas chargé ici, c'est à nous de la poser.
 *
 * Rendue à Vue plutôt qu'écrite en CSS car aucune règle ne sait « rester
 * vraie 200 ms après un changement de classe ».
 */
export function useFermetureProgressive(ouvert: Ref<boolean>) {
  const fermeture = ref(false)
  let minuteur: ReturnType<typeof setTimeout> | undefined

  watch(ouvert, (estOuvert) => {
    clearTimeout(minuteur)
    // Réouverture pendant le fondu : le menu redevient franchement
    // ouvert, sans laisser traîner l'état de sortie.
    if (estOuvert) {
      fermeture.value = false
      return
    }
    fermeture.value = true
    minuteur = setTimeout(() => (fermeture.value = false), DUREE_FERMETURE_MS)
  })

  onBeforeUnmount(() => clearTimeout(minuteur))

  return fermeture
}
