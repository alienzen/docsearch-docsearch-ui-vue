import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Raccourcis clavier des pages d'administration et de statistiques.
 *
 * `ADMIN_SHORTCUTS` (constants.ts) doit rester le reflet exact de ce qui
 * est branché ici : c'est cette constante qu'affichent la palette et
 * l'aide administrateur.
 *
 * Les touches communes avec la recherche gardent leur sens — « t »
 * replie tout, « h » remonte, « ? » ouvre la palette. L'ancienne « a »
 * du repli global est abandonnée au profit de « t » : deux touches pour
 * le même geste selon la page était une incohérence.
 *
 * Jamais actifs pendant une saisie : ces pages sont pleines de champs
 * texte et de listes déroulantes, où « r » et « t » sont des lettres
 * comme les autres. Chaque action est facultative — la page de
 * statistiques n'a rien à recharger panneau par panneau.
 */
export function useAdminShortcuts(actions: {
  reload?: () => void
  toggleAll?: () => void
  toggleShortcuts?: () => void
  /** Replie ou déplie la Nième section, 0 pour la première. */
  toggleAt?: (index: number) => void
  /** Donne le focus à la ligne de recherche du sommaire. */
  focusSearch?: () => void
  /** Escamote ou rétablit le sommaire. */
  toggleSommaire?: () => void
}) {
  function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable
  }

  function onKeydown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return
    switch (e.key) {
      case 'r':
      case 'R':
        if (!actions.reload) return
        e.preventDefault()
        actions.reload()
        break
      case 't':
      case 'T':
        if (!actions.toggleAll) return
        e.preventDefault()
        actions.toggleAll()
        break
      // Chiffres : la Nième section, dans l'ordre d'affichage.
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        if (!actions.toggleAt) return
        e.preventDefault()
        actions.toggleAt(Number(e.key) - 1)
        break
      case 'h':
      case 'H':
        window.scrollTo({ top: 0, behavior: 'smooth' })
        break
      // « s » comme sommaire, par symétrie avec le « f » des filtres de
      // la recherche : même geste — escamoter la colonne latérale pour
      // laisser toute la largeur au contenu.
      case 's':
      case 'S':
        if (!actions.toggleSommaire) return
        e.preventDefault()
        actions.toggleSommaire()
        break
      // Convention habituelle du « aller à » ; les lettres restant
      // toutes prises par les commandes de la page.
      case '/':
        if (!actions.focusSearch) return
        e.preventDefault()
        actions.focusSearch()
        break
      case '?':
        if (!actions.toggleShortcuts) return
        e.preventDefault()
        actions.toggleShortcuts()
        break
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
