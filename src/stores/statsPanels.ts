import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

/**
 * État replié/déplié des panneaux de la page de statistiques.
 *
 * Clé localStorage distincte de celle des facettes de la recherche et de
 * celle d'admin.html : replier des panneaux ici ne doit rien changer
 * ailleurs.
 */
const STORAGE_KEY = 'docsearch-stats-collapsed-panels'

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export const useStatsPanelsStore = defineStore('statsPanels', () => {
  const collapsed = ref<string[]>(read())
  /** Renseigné par la page : tous les identifiants de panneaux affichés. */
  const known = ref<string[]>([])

  function isCollapsed(id: string) {
    return collapsed.value.includes(id)
  }

  function toggle(id: string) {
    collapsed.value = isCollapsed(id)
      ? collapsed.value.filter((x) => x !== id)
      : [...collapsed.value, id]
  }

  /**
   * Un seul bouton pour tout replier ou tout déplier : tant qu'au moins
   * un panneau est ouvert, l'action est « tout replier » ; une fois tout
   * replié, elle devient « tout déplier ».
   */
  const anyExpanded = computed(() => known.value.some((id) => !isCollapsed(id)))

  function toggleAll() {
    collapsed.value = anyExpanded.value ? [...known.value] : []
  }

  watch(collapsed, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* stockage indisponible : le pli vaut pour la session */
    }
  })

  return { collapsed, known, isCollapsed, toggle, anyExpanded, toggleAll }
})
