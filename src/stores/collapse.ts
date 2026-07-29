import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

/**
 * Fabrique de stores « panneaux repliés », partagée par les pages qui en
 * ont besoin (statistiques, administration).
 *
 * Chaque page a sa PROPRE clé localStorage : replier un panneau des
 * statistiques ne doit rien changer côté administration. Les clés sont
 * celles de docsearch-ui, pour qu'un utilisateur retrouve ses panneaux
 * dans l'état où il les avait laissés après la bascule.
 */
export function createCollapseStore(storeId: string, storageKey: string) {
  function read(): string[] {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch {
      return []
    }
  }

  return defineStore(storeId, () => {
    const collapsed = ref<string[]>(read())
    /** Renseigné par la page : tous les identifiants affichés. */
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
     * Un seul bouton pour tout replier ou tout déplier : tant qu'au
     * moins un est ouvert, l'action est « tout replier » ; une fois tout
     * replié, elle devient « tout déplier ».
     */
    const anyExpanded = computed(() => known.value.some((id) => !isCollapsed(id)))

    function toggleAll() {
      collapsed.value = anyExpanded.value ? [...known.value] : []
    }

    watch(collapsed, (value) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        /* stockage indisponible : le pli vaut pour la session */
      }
    })

    return { collapsed, known, isCollapsed, toggle, anyExpanded, toggleAll }
  })
}
