import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Raccourcis clavier du panneau d'administration. Portage du `keydown`
 * de docsearch-ui/public/admin.html — mêmes touches que celles publiées
 * par la page d'aide administrateur.
 *
 * Jamais actifs pendant une saisie : cette page est pleine de champs
 * texte et de listes déroulantes, où « r » et « a » sont des lettres
 * comme les autres.
 */
export function useAdminShortcuts(actions: { reload: () => void; toggleAll: () => void }) {
  function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable
  }

  function onKeydown(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return
    switch (e.key) {
      case 'r':
      case 'R':
        e.preventDefault()
        actions.reload()
        break
      case 'a':
      case 'A':
        e.preventDefault()
        actions.toggleAll()
        break
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
