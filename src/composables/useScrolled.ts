import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Vrai une fois la page défilée au-delà du seuil.
 *
 * Sert au bouton « Haut de page » : proposer de remonter alors qu'on est
 * déjà en haut n'a pas de sens. Même seuil que docsearch-ui (300 px).
 *
 * `seuilRetour` permet une HYSTÉRÉSIS : l'état se relâche plus bas qu'il
 * ne s'établit. Indispensable dès que l'état modifie la hauteur du
 * contenu — l'en-tête réduit (useHeaderReduit) remonte la page en se
 * repliant, et un seuil unique le ferait battre autour de sa limite.
 * Laissé égal au seuil par défaut : le bouton « Haut de page » ne change
 * rien à la mise en page, il n'a rien à amortir.
 */
export function useScrolled(seuil = 300, seuilRetour = seuil) {
  const scrolled = ref(false)

  function onScroll() {
    scrolled.value = scrolled.value ? window.scrollY > seuilRetour : window.scrollY > seuil
  }

  onMounted(() => {
    // `passive` : ce gestionnaire ne bloque jamais le défilement.
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  })
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

  return { scrolled }
}
