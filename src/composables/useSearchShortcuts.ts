import { onBeforeUnmount, onMounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'

/**
 * Raccourcis clavier de la page de recherche. Portage du `keydown` de
 * docsearch-ui/public/js/init.js — mêmes touches, mêmes garde-fous
 * (voir help.html, qui en publie la liste).
 *
 * Ceux qui pilotent des fonctionnalités pas encore migrées (s :
 * enregistrer la recherche ; ? : aide en modale) ne sont volontairement
 * pas branchés ici plutôt que branchés sur du vide — ils reviendront
 * avec elles.
 */
export function useSearchShortcuts() {
  const store = useSearchStore()
  const preferences = usePreferencesStore()

  /**
   * Les raccourcis à une lettre ne doivent jamais interférer avec une
   * saisie (barre de recherche, champs des modales). Échap reste actif
   * en toute circonstance — c'est le seul.
   */
  function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      ;(document.activeElement as HTMLElement | null)?.blur()
      return
    }
    if (isTypingTarget(e.target)) return

    // Les raccourcis agissant sur les résultats n'ont de sens qu'une
    // fois une recherche lancée.
    const resultsVisible = store.hasSearched

    switch (e.key) {
      case '/':
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.fr-search-bar input')?.focus()
        break
      case 'ArrowLeft':
        if (resultsVisible && store.page > 1) {
          e.preventDefault()
          store.goToPage(store.page - 1)
        }
        break
      case 'ArrowRight':
        if (resultsVisible && store.page < store.totalPages) {
          e.preventDefault()
          store.goToPage(store.page + 1)
        }
        break
      case 'c':
      case 'C':
        if (resultsVisible) preferences.resultsCompact = !preferences.resultsCompact
        break
      case 'r':
      case 'R':
        // Ne touche qu'aux facettes et à la période.
        if (resultsVisible) store.clearAllFilters()
        break
      case 'n':
      case 'N':
        // Contrairement à « r » : réinitialisation complète, requête et
        // tri compris.
        if (resultsVisible) store.resetSearch()
        break
      case 'h':
      case 'H':
        window.scrollTo({ top: 0, behavior: 'smooth' })
        break
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
