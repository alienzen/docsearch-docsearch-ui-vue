import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Publie la hauteur de l'en-tête dans la variable CSS
 * `--ds-header-height`.
 *
 * Nécessaire parce que l'en-tête est collant : sans cette mesure, la
 * colonne de facettes — collante elle aussi — se figerait SOUS lui et
 * disparaîtrait derrière. La hauteur ne peut pas être écrite en dur :
 * elle dépend du logo personnalisé, de la longueur du titre et du
 * retour à la ligne de la navigation sur écran étroit.
 *
 * C'est le même besoin que syncSidebarOffset() dans docsearch-ui, mais
 * la valeur alimente ici une variable CSS au lieu d'être appliquée
 * élément par élément.
 */
export function useHeaderHeight() {
  let observer: ResizeObserver | undefined

  function publish(height: number) {
    document.documentElement.style.setProperty('--ds-header-height', `${Math.round(height)}px`)
  }

  onMounted(() => {
    const header = document.querySelector('header.fr-header')
    if (!header) return
    publish(header.getBoundingClientRect().height)
    // ResizeObserver plutôt qu'un écouteur de redimensionnement : la
    // hauteur change aussi quand le logo asynchrone arrive ou quand la
    // navigation passe sur deux lignes, sans que la fenêtre bouge.
    observer = new ResizeObserver(([entry]) => publish(entry.contentRect.height))
    observer.observe(header)
  })

  onBeforeUnmount(() => observer?.disconnect())
}
