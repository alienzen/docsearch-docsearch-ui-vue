<script setup lang="ts">
/**
 * État des composants (Elasticsearch, Redis, Kafka, Tika, workers,
 * watcher, file d'indexation). Seul panneau rafraîchi périodiquement.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getStatus, type AdminStatus } from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'

const REFRESH_MS = 5000

const { data, error, refresh } = useStatsPanel<AdminStatus>(getStatus)

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  // Rafraîchissement léger et périodique de CE panneau seulement : les
  // panneaux de configuration ne doivent pas être réécrits pendant que
  // l'utilisateur les édite.
  timer = setInterval(silentRefresh, REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))

const staleSince = ref<string | null>(null)

async function silentRefresh() {
  // Un échec transitoire (ES ou Redis momentanément indisponible) ne
  // doit pas remplacer l'état affiché par une erreur : on garde la
  // dernière valeur connue et on le signale discrètement.
  const previous = data.value
  await refresh()
  if (error.value && previous) {
    data.value = previous
    staleSince.value = new Date().toLocaleTimeString('fr-FR')
    error.value = null
  } else if (!error.value) {
    staleSince.value = null
  }
}

type Card = { name: string; value: string; up: boolean | null; hint?: string }

const cards = computed<Card[]>(() => {
  const s = data.value
  if (!s) return []
  const tika = s.tika || {}
  const workers = s.workers || {}
  const watcher = s.watcher || {}
  return [
    {
      name: 'Elasticsearch',
      value: s.elasticsearch?.status || (s.elasticsearch?.up ? 'up' : 'down'),
      // Elasticsearch a trois états (green/yellow/red), pas deux : un
      // cluster « yellow » fonctionne mais mérite d'être signalé.
      up: s.elasticsearch?.up ? s.elasticsearch.status !== 'red' : false,
    },
    { name: 'Redis', value: s.redis?.up ? 'up' : 'down', up: !!s.redis?.up },
    { name: 'Kafka', value: s.kafka?.up ? 'up' : 'down', up: !!s.kafka?.up },
    {
      name: 'Tika',
      value: `${tika.up_count ?? '?'}/${tika.total ?? '?'} instances`,
      up: (tika.up_count ?? 0) > 0,
    },
    {
      name: 'Workers actifs',
      value: String(workers.active_workers ?? '?'),
      up: (workers.active_workers ?? 0) > 0,
    },
    {
      name: 'Watcher',
      value: watcher.alive ? 'actif' : 'silencieux',
      up: !!watcher.alive,
      hint:
        watcher.last_seen_seconds_ago != null
          ? `vu il y a ${watcher.last_seen_seconds_ago}s`
          : undefined,
    },
    {
      name: "File d'indexation",
      value: String(workers.pending_documents ?? '?'),
      up: null,
      hint: 'document(s) en attente de traitement',
    },
  ]
})
</script>

<template>
  <AdminPanel
    id="status-panel"
    title="État des composants"
    subtitle="rafraîchi toutes les 5s"
    :error="error"
  >
    <p v-if="staleSince" class="fr-hint-text">
      Dernier rafraîchissement en échec ({{ staleSince }}) — valeurs précédentes affichées.
    </p>
    <div class="ds-stats__cards">
      <div v-for="card in cards" :key="card.name" class="ds-stats__card">
        <p class="fr-hint-text fr-mb-0">{{ card.name }}</p>
        <p class="ds-stats__value">
          <DsfrBadge
            v-if="card.up !== null"
            :type="card.up ? 'success' : 'error'"
            small
            no-icon
            :label="card.up ? 'OK' : 'KO'"
          />
          {{ card.value }}
        </p>
        <p v-if="card.hint" class="fr-hint-text fr-mb-0">{{ card.hint }}</p>
      </div>
    </div>
  </AdminPanel>
</template>
