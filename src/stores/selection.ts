import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Documents cochés en vue d'un ajout à une collection (`selectedDocs`
 * en vanilla). Dans un store plutôt que local à la liste de résultats :
 * la barre de sélection et la modale de collection ont besoin de la même
 * information.
 */
export const useSelectionStore = defineStore('selection', () => {
  const selected = ref<Set<string>>(new Set())

  const count = computed(() => selected.value.size)
  const ids = computed(() => [...selected.value])

  function has(id: string) {
    return selected.value.has(id)
  }

  function set(id: string, checked: boolean) {
    // Un nouveau Set à chaque fois : muter celui existant ne
    // déclencherait pas la réactivité de Vue.
    const next = new Set(selected.value)
    if (checked) next.add(id)
    else next.delete(id)
    selected.value = next
  }

  function clear() {
    selected.value = new Set()
  }

  return { selected, count, ids, has, set, clear }
})
