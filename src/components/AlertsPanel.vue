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
  purgeAlerts,
  type AlertNotification,
  type SavedSearch,
} from '@/api/savedSearches'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useDialogs } from '@/composables/useDialogs'

const store = useSearchStore()
const uiConfig = useUiConfigStore()
const { confirm } = useDialogs()

const notifications = ref<AlertNotification[]>([])
const savedList = ref<SavedSearch[]>([])
const unseen = ref(0)
/**
 * Nombre TOTAL de notifications, lues comprises. Pilote l'affichage de
 * l'entrée, là où `unseen` ne pilote que le badge : une alerte déjà
 * consultée reste consultable.
 */
const total = ref(0)
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
    const notifs = await listAlerts()
    total.value = notifs.length
    unseen.value = notifs.filter((n) => !n.seen).length
  } catch {
    // API indisponible : le badge reste à son dernier état connu.
  }
}

const menu = ref<{ close: () => void } | null>(null)

/** Chargé à l'ouverture du menu. */
async function load() {
  loading.value = true
  error.value = null
  try {
    // La liste des recherches enregistrées est nécessaire pour relancer
    // celle visée au clic : une notification ne porte que l'identifiant
    // et le nom, pas les critères.
    const [notifs, saved] = await Promise.all([listAlerts(), listSavedSearches()])
    notifications.value = notifs
    total.value = notifs.length
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

/**
 * Vide la liste. La confirmation est de rigueur : les notifications ne
 * se reconstituent pas, seule une nouvelle vérification positive du
 * worker en redéposera.
 */
async function purge() {
  const ok = await confirm(
    'Effacer toutes vos notifications ? Vos recherches enregistrées et leurs alertes ne sont pas touchées.',
    { title: 'Effacer les notifications', confirmLabel: 'Effacer' },
  )
  if (!ok) return
  try {
    await purgeAlerts()
    notifications.value = []
    total.value = 0
    unseen.value = 0
    menu.value?.close()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
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
  menu.value?.close()
  store.applySavedSearch(saved)
}

onMounted(refreshBadge)
</script>

<template>
  <NavMenuItem
    v-if="total"
    ref="menu"
    label="Alertes"
    :badge="unseen > 0 ? badge : null"
    @open="load"
  >
    <li v-if="loading" class="ds-menu__message">Chargement…</li>
    <li v-else-if="error" class="ds-menu__message">
      <DsfrAlert type="error" small :description="error" />
    </li>

    <li v-for="(notification, i) in notifications" v-else :key="i" class="ds-menu__entry">
      <button class="fr-nav__link ds-menu__button" @click="apply(notification)">
        <span class="ds-menu__name">{{ notification.saved_search_name }}</span>
        <span class="fr-hint-text fr-mb-0">
          {{
            notification.new_count > 1
              ? `${notification.new_count} nouveaux résultats`
              : '1 nouveau résultat'
          }}
          · {{ formatDate(notification.checked_at) }}
        </span>
      </button>
    </li>

    <!-- Après la liste : une action destructrice ne doit pas être le
         premier élément atteint au clavier dans un menu qu'on ouvre pour
         consulter. -->
    <li v-if="notifications.length" class="ds-menu__entry ds-menu__footer">
      <div class="fr-px-2w">
        <DsfrButton
          size="sm"
          tertiary
          label="Effacer toutes les notifications"
          @click="purge()"
        />
      </div>
    </li>
  </NavMenuItem>
</template>
