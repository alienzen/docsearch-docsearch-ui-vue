<script setup lang="ts">
/**
 * Panneau « Alertes » — notifications in-app des recherches
 * enregistrées. Portage de la seconde moitié de
 * docsearch-ui/public/js/saved-searches.js.
 *
 * Volontairement in-app et jamais par email : une notification cite le
 * nom de la recherche et le nombre de résultats, qui ne doivent pas
 * sortir du périmètre ACL.
 */
import { computed, onMounted, ref } from 'vue'
import {
  listAlerts,
  listSavedSearches,
  markAllAlertsSeen,
  type AlertNotification,
  type SavedSearch,
} from '@/api/savedSearches'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const open = ref(false)
const notifications = ref<AlertNotification[]>([])
const savedList = ref<SavedSearch[]>([])
const unseen = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const badge = computed(() => (unseen.value > 9 ? '9+' : String(unseen.value)))

/**
 * Compteur rafraîchi au chargement de la page, pour refléter les
 * alertes accumulées depuis la dernière visite sans attendre que
 * l'utilisateur ouvre le panneau.
 */
async function refreshBadge() {
  if (!uiConfig.config.alerts_enabled) return
  try {
    unseen.value = (await listAlerts()).filter((n) => !n.seen).length
  } catch {
    // API indisponible : le badge reste à son dernier état connu.
  }
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  loading.value = true
  error.value = null
  try {
    // La liste des recherches enregistrées est nécessaire pour relancer
    // celle visée au clic : une notification ne porte que l'identifiant
    // et le nom, pas les critères.
    const [notifs, saved] = await Promise.all([listAlerts(), listSavedSearches()])
    notifications.value = notifs
    savedList.value = saved
    // Ouvrir le panneau vaut consultation : tout est marqué comme lu,
    // plutôt que d'exiger un clic par notification.
    if (notifs.some((n) => !n.seen)) await markAllAlertsSeen()
    unseen.value = 0
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function apply(notification: AlertNotification) {
  const saved = savedList.value.find((s) => s.id === notification.saved_search_id)
  if (!saved) {
    error.value = 'Cette recherche enregistrée a été supprimée depuis.'
    return
  }
  open.value = false
  store.applySavedSearch(saved)
}

onMounted(refreshBadge)
</script>

<template>
  <div class="ds-panel">
    <DsfrButton size="sm" tertiary no-outline :aria-expanded="open" @click="toggle">
      Alertes
      <span v-if="unseen > 0" class="fr-badge fr-badge--sm fr-badge--error fr-ml-1v">
        {{ badge }}
      </span>
    </DsfrButton>

    <div v-if="open" class="ds-panel__body">
      <p v-if="loading" class="fr-hint-text fr-mb-0">Chargement…</p>
      <DsfrAlert v-else-if="error" type="error" small :description="error" />
      <p v-else-if="!notifications.length" class="fr-hint-text fr-mb-0">
        Aucune alerte pour le moment.
      </p>

      <div v-for="(notification, i) in notifications" v-else :key="i" class="ds-panel__item">
        <button class="ds-panel__item-button" @click="apply(notification)">
          <span class="ds-panel__item-name">{{ notification.saved_search_name }}</span>
          <span class="fr-hint-text fr-mb-0">
            {{ notification.new_count > 1 ? `${notification.new_count} nouveaux résultats` : '1 nouveau résultat' }}
            · {{ formatDate(notification.checked_at) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
