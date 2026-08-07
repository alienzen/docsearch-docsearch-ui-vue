<script setup lang="ts">
/**
 * État des composants (Elasticsearch, Redis, Kafka, Tika, workers,
 * watcher, file d'indexation). Seul panneau rafraîchi périodiquement.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getStatus, type AdminStatus } from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { BUILD_DATE, COMMIT, VERSION } from '@/version'

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

// ── Versions déployées ──────────────────────────────────────
/**
 * Une ligne par brique applicative. L'interface se décrit elle-même
 * (constantes figées dans son bundle), l'API et l'ingestion viennent de
 * /admin/status. C'est le seul écran qui rende visible une dérive entre
 * composants : les trois dépôts se déployant indépendamment, un
 * conteneur oublié lors d'une mise à jour ne se signale autrement par
 * aucun symptôme, jusqu'à ce qu'il en produise un d'incompréhensible.
 */
type LigneVersion = { nom: string; version: string; detail: string }

/** « build a1b2c3d du 07/08/2026 », ou rien si l'estampille manque. */
function detailBuild(commit?: string, buildDate?: string): string {
  if (!commit || commit === 'inconnu') return 'estampille de build absente'
  const parsed = buildDate ? new Date(buildDate) : null
  const date =
    parsed && !Number.isNaN(parsed.getTime()) ? ` du ${parsed.toLocaleDateString('fr-FR')}` : ''
  return `build ${commit}${date}`
}

const versions = computed<LigneVersion[]>(() => {
  const dispo = data.value?.versions || {}
  const lignes: LigneVersion[] = [
    { nom: 'Interface', version: VERSION, detail: detailBuild(COMMIT, BUILD_DATE) },
  ]
  const api = dispo.api
  lignes.push({
    nom: 'API',
    version: api?.version || '?',
    detail: api ? detailBuild(api.commit, api.build_date) : 'non renseignée',
  })
  const ingestion = dispo.ingestion
  lignes.push({
    nom: 'Ingestion',
    version: ingestion?.version || '?',
    detail: ingestion
      ? `${detailBuild(ingestion.commit, ingestion.build_date)} · ${ingestion.source || 'watcher'}`
      : 'aucun battement de watcher reçu',
  })
  return lignes
})

/**
 * Vrai dès que deux briques n'annoncent pas la même version PRODUIT.
 * Les versions inconnues (« ? ») ne comptent pas : un watcher arrêté
 * n'est pas une dérive de version, et le panneau le signale déjà par
 * ailleurs.
 */
const versionsDivergentes = computed(() => {
  const connues = new Set(versions.value.map((l) => l.version).filter((v) => v !== '?'))
  return connues.size > 1
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
    <div class="ds-stats__cards fr-mt-2w">
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

    <h3 class="fr-h6 fr-mt-4w fr-mb-1w">Versions déployées</h3>
    <DsfrAlert
      v-if="versionsDivergentes"
      type="warning"
      small
      description="Les briques n'annoncent pas la même version : une mise à jour est probablement incomplète."
      class="fr-mb-2w"
    />
    <div class="ds-stats__cards">
      <div v-for="ligne in versions" :key="ligne.nom" class="ds-stats__card">
        <p class="fr-hint-text fr-mb-0">{{ ligne.nom }}</p>
        <p class="ds-stats__value">{{ ligne.version }}</p>
        <p class="fr-hint-text fr-mb-0">{{ ligne.detail }}</p>
      </div>
    </div>
    <!-- Portée réelle de la ligne « Ingestion » : le watcher ne tourne
         que sur ingest-1. Les workers Kafka d'ingest-2 et ingest-3
         partagent la même image mais se mettent à jour machine par
         machine — pendant une mise à jour rolling, cette ligne ne dit
         rien de leur version. Le dire ici plutôt que de laisser croire
         à une couverture complète. -->
    <p class="fr-hint-text fr-mt-1w fr-mb-0">
      « Ingestion » est relevée sur le watcher (ingest-1) ; les workers des autres machines
      d'ingestion partagent cette image mais ne sont pas interrogés individuellement.
    </p>
  </AdminPanel>
</template>
