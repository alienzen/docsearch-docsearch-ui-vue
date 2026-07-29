import { onBeforeUnmount, onMounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'

type Actions = {
  /** Appelé par « s » — enregistrer la recherche en cours. */
  saveCurrentSearch?: () => void
  /** Appelé par « ? » — ouvrir l'aide dans un nouvel onglet. */
  openHelp?: () => void
}

/**
 * Raccourcis clavier de la page de recherche. Portage du `keydown` de
 * docsearch-ui/public/js/init.js — mêmes touches, mêmes garde-fous.
 *
 * La liste publiée par SearchHelp.vue doit rester le reflet exact de ce
 * qui est branché ici : une aide qui décrit une touche inopérante est
 * pire que pas d'aide.
 */
export function useSearchShortcuts(actions: Actions = {}) {
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
      case 'f':
      case 'F':
        // La colonne n'existe qu'une fois une recherche lancée : hors de
        // là, la touche basculerait une préférence sans rien changer à
        // l'écran.
        if (resultsVisible) preferences.facetsHidden = !preferences.facetsHidden
        break
      case 's':
      case 'S':
        if (resultsVisible) actions.saveCurrentSearch?.()
        break
      case '?':
        // Pas de garde `resultsVisible` : consulter la syntaxe avant de
        // formuler sa première recherche est justement le cas utile.
        // L'ouverture d'onglet part d'un événement clavier, donc d'une
        // interaction utilisateur : les bloqueurs de fenêtres surgissantes
        // la laissent passer.
        e.preventDefault()
        actions.openHelp?.()
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
