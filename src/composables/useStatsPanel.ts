import { inject, onMounted, ref } from 'vue'

/**
 * Chargement des données d'un panneau de statistiques.
 *
 * Chaque panneau gère son propre échec (message dans le panneau), sauf
 * un refus d'accès 401/403 : celui-ci est signalé à la page, qui
 * remplace tout par un bandeau unique — inutile de répéter six fois
 * « Accès refusé ».
 */
export function useStatsPanel<T>(load: () => Promise<T>) {
  const data = ref<T | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  const reportError = inject<(e: unknown) => void>('reportError', () => {})

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      data.value = await load()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      reportError(e)
    } finally {
      loading.value = false
    }
  }

  onMounted(refresh)

  return { data, error, loading, refresh }
}
