import { onBeforeUnmount, ref } from 'vue'

/**
 * Confirmation « ✓ enregistré » éphémère à côté d'un bouton. Portage du
 * motif `.save-hint` de docsearch-ui/public/admin.html, présent sur
 * chaque ligne enregistrable.
 *
 * Une seule clé à la fois : afficher la confirmation ailleurs efface la
 * précédente, ce qui évite d'accumuler des ✓ sur toute une table.
 */
export function useSaveHint(durationMs = 1500) {
  const saved = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function flash(key: string) {
    saved.value = key
    clearTimeout(timer)
    timer = setTimeout(() => (saved.value = null), durationMs)
  }

  // Sans ça, le minuteur écrirait dans un composant démonté (le
  // panneau peut être replié entre-temps).
  onBeforeUnmount(() => clearTimeout(timer))

  return { saved, flash }
}
