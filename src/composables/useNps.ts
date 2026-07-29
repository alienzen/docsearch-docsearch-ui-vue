import { ref } from 'vue'

/**
 * Déclenchement de la popup NPS. Portage de maybeShowNps()
 * (docsearch-ui/public/js/feedback.js) — mêmes seuils et mêmes clés
 * localStorage, pour qu'un utilisateur déjà sollicité récemment ne le
 * soit pas à nouveau du seul fait de la bascule vers cette interface.
 */
const SEARCH_COUNT_KEY = 'docsearch-search-count'
const LAST_SHOWN_KEY = 'docsearch-nps-last-shown'
const EVERY_N_SEARCHES = 20
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

function readInt(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) || '0', 10)
  } catch {
    return 0
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* stockage indisponible : la popup pourra réapparaître plus tôt */
  }
}

export function useNps(enabled: () => boolean) {
  const visible = ref(false)

  /**
   * À appeler après CHAQUE recherche réussie : le compteur avance même
   * quand la popup n'est pas affichable, comme en vanilla.
   */
  function maybeShow() {
    if (!enabled()) return
    const count = readInt(SEARCH_COUNT_KEY) + 1
    write(SEARCH_COUNT_KEY, String(count))
    if (count % EVERY_N_SEARCHES !== 0) return
    if (Date.now() - readInt(LAST_SHOWN_KEY) < COOLDOWN_MS) return
    write(LAST_SHOWN_KEY, String(Date.now()))
    visible.value = true
  }

  return { visible, maybeShow }
}
