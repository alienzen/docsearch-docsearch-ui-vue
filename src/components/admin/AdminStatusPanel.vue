<script setup lang="ts">
/**
 * État des composants (Elasticsearch, Redis, Kafka, Tika, workers,
 * watcher, file d'indexation), plus les écritures que le statut de
 * cluster ne couvre pas : journalisation des recherches, recueil des
 * suggestions et réponses NPS. Seul panneau rafraîchi périodiquement.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getStatus, type AdminStatus, type WriteProbe } from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { BUILD_DATE, COMMIT, VERSION } from '@/version'

const REFRESH_MS = 5000

const props = defineProps<{
  /**
   * Compteur de rechargement de la page : chaque incrément demande un
   * rafraîchissement immédiat. Les autres panneaux sont remontés par la
   * page pour se recharger ; celui-ci ne l'est pas, sinon ses cartes
   * disparaîtraient le temps de la requête alors qu'il n'a que des
   * valeurs à remplacer sur place — c'est déjà ce qu'il fait toutes les
   * 5s. Voir AdminPage.
   */
  rechargement?: number
}>()

const { data, error, refresh } = useStatsPanel<AdminStatus>(getStatus)

watch(() => props.rechargement, silentRefresh)

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

/**
 * Carte d'une sonde d'écriture — les deux canaux (suggestions, NPS) ont
 * exactement la même forme, seul l'index sondé change.
 *
 * `reason` en repli plutôt qu'une phrase rassurante par défaut : une API
 * antérieure à ces cartes n'envoie pas du tout la clé, et afficher
 * « l'index accepte les écritures » reviendrait alors à affirmer ce
 * qu'on n'a pas vérifié.
 */
function carteSonde(name: string, sonde: WriteProbe): Card {
  return {
    name,
    value: sonde.ok == null ? 'inconnu' : sonde.ok ? 'actives' : 'bloquées',
    up: sonde.ok ?? null,
    hint:
      sonde.ok == null
        ? sonde.reason
        : sonde.ok
          ? "l'index accepte les écritures"
          : (sonde.error ?? undefined),
  }
}

const cards = computed<Card[]>(() => {
  const s = data.value
  if (!s) return []
  const tika = s.tika || {}
  const workers = s.workers || {}
  const watcher = s.watcher || {}
  const journal = s.search_log || {}
  const suggestions = s.suggestions || {}
  const nps = s.nps || {}
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
    // Aucune des cartes ci-dessus ne couvre ce cas : un cluster « green »
    // dont les index sont bloqués en lecture seule affiche du vert
    // partout, pendant que plus une recherche n'est journalisée. Voir le
    // commentaire de search_log.health() côté API.
    {
      name: 'Journalisation',
      value: journal.ok == null ? 'inconnue' : journal.ok ? 'active' : 'en échec',
      up: journal.ok ?? null,
      hint:
        journal.ok == null
          ? journal.reason
          : `dernière tentative il y a ${journal.last_attempt_seconds_ago ?? '?'}s`,
    },
    // Même blocage, autres victimes — et celles-ci ne se déduisent pas de
    // la carte précédente : une suggestion ou une note perdue ne laisse
    // RIEN derrière elle, pas même la disparition d'un bouton. Sondées à
    // chaque rafraîchissement plutôt que déduites de la dernière
    // contribution reçue, qui peut dater de trois semaines (voir
    // cluster_status._check_write_blocks()).
    carteSonde('Suggestions', suggestions),
    carteSonde('Réponses NPS', nps),
  ]
})

/**
 * L'échec est le seul état qui mérite d'interrompre la lecture : il est
 * invisible partout ailleurs, y compris pour l'utilisateur, à qui trois
 * fonctionnalités disparaissent sans explication. Le message d'ES est
 * repris tel quel — c'est lui qui nomme la cause (disque saturé, mapping
 * refusé, index bloqué), et le résumer reviendrait à la deviner.
 */
const journalEnEchec = computed(() => data.value?.search_log?.ok === false)

const descriptionEchecJournal = computed(
  () =>
    `${data.value?.search_log?.error || 'cause non rapportée'} — conséquences côté utilisateur, ` +
    `elles aussi silencieuses : plus de pouce « utile / peu utile » sous les résultats, ` +
    `plus de popup de satisfaction, plus de suivi des clics, et la page Statistiques ` +
    `cesse de se remplir.`,
)

/**
 * Alerte distincte de celle du journal, même quand les pannes n'ont
 * qu'une seule cause (disque saturé) : la conséquence, elle, n'est pas
 * la même. Une recherche non journalisée est une statistique perdue ;
 * une suggestion ou une note non enregistrée est le message d'un
 * utilisateur qui croit l'avoir envoyé.
 *
 * UNE seule alerte pour les deux canaux, en revanche : ils tombent
 * toujours ensemble, et deux blocs rouges nommant le même disque saturé
 * se liraient comme deux pannes à réparer. Le titre nomme les canaux
 * réellement touchés.
 */
type CanalPerdu = { nom: string; perte: string; erreur?: string | null }

const canauxBloques = computed<CanalPerdu[]>(() => {
  const s = data.value
  const canaux: CanalPerdu[] = []
  if (s?.suggestions?.ok === false) {
    canaux.push({
      nom: 'Les suggestions',
      perte: 'les idées envoyées depuis le blocage sont perdues',
      erreur: s.suggestions.error,
    })
  }
  if (s?.nps?.ok === false) {
    canaux.push({
      nom: 'Les réponses NPS',
      perte: 'les notes de satisfaction envoyées depuis le blocage sont perdues',
      erreur: s.nps.error,
    })
  }
  return canaux
})

const titreCanauxBloques = computed(() =>
  canauxBloques.value.length > 1
    ? 'Les suggestions et les réponses NPS ne sont plus enregistrées'
    : `${canauxBloques.value[0]?.nom} ne sont plus enregistrées`,
)

const descriptionCanauxBloques = computed(() => {
  const cause = canauxBloques.value.find((c) => c.erreur)?.erreur || 'cause non rapportée'
  const pertes = canauxBloques.value.map((c) => c.perte).join(', et ')
  return (
    `${cause} — l'interface remercie pourtant l'utilisateur comme si de rien n'était : ` +
    `${pertes}, seul le journal de l'API en garde la trace.`
  )
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
    <DsfrAlert
      v-if="journalEnEchec"
      id="status-journal-echec"
      type="error"
      title="Les recherches ne sont plus journalisées"
      :description="descriptionEchecJournal"
      class="fr-mt-2w"
    />
    <DsfrAlert
      v-if="canauxBloques.length"
      id="status-suggestions-bloquees"
      type="error"
      :title="titreCanauxBloques"
      :description="descriptionCanauxBloques"
      class="fr-mt-2w"
    />
    <div id="status-cartes" class="ds-stats__cards fr-mt-2w">
      <div
        v-for="card in cards"
        :key="card.name"
        class="ds-stats__card"
        data-testid="status-carte"
        :data-brique="card.name"
      >
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

    <h3 id="status-versions-titre" class="fr-h6 fr-mt-4w fr-mb-1w">Versions déployées</h3>
    <DsfrAlert
      v-if="versionsDivergentes"
      id="status-versions-divergentes"
      type="warning"
      small
      description="Les briques n'annoncent pas la même version : une mise à jour est probablement incomplète."
      class="fr-mb-2w"
    />
    <div id="status-versions" class="ds-stats__cards">
      <div
        v-for="ligne in versions"
        :key="ligne.nom"
        class="ds-stats__card"
        data-testid="status-version"
        :data-brique="ligne.nom"
      >
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
