import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Vrai une fois la page défilée au-delà du seuil.
 *
 * Sert au bouton « Haut de page » : proposer de remonter alors qu'on est
 * déjà en haut n'a pas de sens. Même seuil que docsearch-ui (300 px).
 */
export function useScrolled(threshold = 300) {
  const scrolled = ref(false)

  function onScroll() {
    scrolled.value = window.scrollY > threshold
  }

  onMounted(() => {
    // `passive` : ce gestionnaire ne bloque jamais le défilement.
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  })
  onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

  return { scrolled }
}
