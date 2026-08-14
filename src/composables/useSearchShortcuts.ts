import { onBeforeUnmount, onMounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'
import { remonterEnHaut } from '@/utils/scroll'

type Actions = {
  /** Appelé par « s » — enregistrer la recherche en cours. */
  saveCurrentSearch?: () => void
  /** Appelé par « ? » — afficher la palette des raccourcis. */
  toggleShortcuts?: () => void
}

/**
 * Raccourcis clavier de la page de recherche. Portage du `keydown` de
 * docsearch-ui/public/js/init.js — mêmes touches, mêmes garde-fous.
 *
 * `SHORTCUTS` (constants.ts) doit rester le reflet exact de ce qui est
 * branché ici : une aide qui décrit une touche inopérante est pire que
 * pas d'aide. C'est cette constante qu'affichent la palette, la page
 * d'aide et les infobulles des commandes.
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
      // Les deux flèches remontent comme le fait la pagination cliquée :
      // le raccourci s'utilise justement en fin de liste, une fois les
      // résultats parcourus, donc à un endroit d'où la page suivante
      // s'ouvrirait sur ses derniers résultats.
      case 'ArrowLeft':
        if (resultsVisible && store.page > 1) {
          e.preventDefault()
          store.goToPage(store.page - 1)
          remonterEnHaut()
        }
        break
      case 'ArrowRight':
        if (resultsVisible && store.page < store.totalPages) {
          e.preventDefault()
          store.goToPage(store.page + 1)
          remonterEnHaut()
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
      // Chiffres : la Nième section de facettes, dans l'ordre où elle
      // est affichée. `presentFacets` est alimenté au montage de chaque
      // section, donc dans cet ordre exactement.
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9': {
        if (!resultsVisible) break
        const id = preferences.presentFacets[Number(e.key) - 1]
        // Silencieux au-delà du nombre de sections : mieux vaut ne rien
        // faire qu'agir sur une autre que celle visée.
        if (!id) break
        e.preventDefault()
        preferences.toggleFacetSection(id)
        break
      }
      case 't':
      case 'T':
        // Même raison, et sans effet aussi quand la colonne est repliée :
        // le registre des sections présentes est alors vide, `toggleAll`
        // n'a rien à parcourir.
        if (resultsVisible) preferences.toggleAllFacets()
        break
      case 's':
      case 'S':
        if (resultsVisible) actions.saveCurrentSearch?.()
        break
      case '?':
        // Pas de garde `resultsVisible` : découvrir les raccourcis avant
        // sa première recherche est justement le cas utile.
        e.preventDefault()
        actions.toggleShortcuts?.()
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
        remonterEnHaut('smooth')
        break
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
