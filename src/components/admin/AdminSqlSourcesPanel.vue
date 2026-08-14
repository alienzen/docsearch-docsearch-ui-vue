<script setup lang="ts">
/**
 * Sources SQL : le résultat d'une requête PostgreSQL/MySQL est indexé
 * dans son propre index Elasticsearch.
 *
 * Pas de bouton « lancer maintenant » ici, contrairement aux sources
 * fichiers : le passage reste au worker SQL, qui interroge à son propre
 * intervalle. L'administration ne gère que le registre — l'API ne
 * résout jamais un DSN et ne se connecte jamais à une base.
 */
import { nextTick, ref } from 'vue'
import {
  createSqlDsn,
  deleteSqlDsn,
  deleteSqlSource,
  getSqlDsns,
  getSqlSources,
  type SqlSource,
} from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useDialogs } from '@/composables/useDialogs'

const { data, error, refresh } = useStatsPanel(async () => ({
  sources: await getSqlSources(),
  dsns: await getSqlDsns(),
}))

const actionError = ref<string | null>(null)
/** Confirmation du dernier enregistrement — voir onSaved(). */
const actionMessage = ref<string | null>(null)
/** null = formulaire fermé ; { name: null } = création. */
const editing = ref<{ name: string | null; source?: SqlSource } | null>(null)

const dsnName = ref('')
const dsnValue = ref('')

async function run(action: () => Promise<unknown>) {
  actionError.value = null
  actionMessage.value = null
  try {
    await action()
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

function facetLabels(source: SqlSource): string {
  const labels = (source.fields || [])
    .filter((f) => f.facet)
    .map((f) => f.facet_label || f.es_field)
  return labels.join(', ') || '—'
}

async function removeSource(name: string) {
  const ok = await confirm(
    `Retirer la source SQL « ${name} » ? Son index Elasticsearch et ses documents ne seront PAS supprimés.`,
    { title: 'Retirer la source SQL', confirmLabel: 'Retirer' },
  )
  if (!ok) return
  return run(() => deleteSqlSource(name))
}

async function removeDsn(name: string) {
  const ok = await confirm(
    `Retirer le DSN chiffré « ${name} » ? Toute source SQL dont le connection_ref pointe vers ce nom échouera à son prochain passage, sauf si une variable d'environnement du même nom existe.`,
    { title: 'Retirer le DSN', confirmLabel: 'Retirer' },
  )
  if (!ok) return
  return run(() => deleteSqlDsn(name))
}

function addDsn() {
  if (!dsnName.value.trim() || !dsnValue.value.trim()) {
    actionError.value = 'Le nom et le DSN sont tous les deux requis.'
    return
  }
  return run(async () => {
    await createSqlDsn(dsnName.value.trim(), dsnValue.value.trim())
    dsnName.value = ''
    // Ne jamais laisser le DSN en clair dans le champ après envoi.
    dsnValue.value = ''
  })
}

/** null = création. */
function openForm(name: string | null, source?: SqlSource) {
  actionError.value = null
  actionMessage.value = null
  editing.value = { name, source }
}

async function onSaved(name: string) {
  editing.value = null
  actionMessage.value = `Source SQL « ${name} » enregistrée. Le worker SQL la reprend au passage suivant.`
  await refresh()
  // La confirmation s'affiche en TÊTE du panneau, alors que l'ouverture
  // du formulaire est partie d'un bouton « Modifier » qui peut être
  // n'importe où dans le tableau, ou du bouton placé sous lui. La modale
  // refermée, la page est restée où elle était : sans ce recentrage, la
  // confirmation apparaîtrait hors de l'écran — donc, pour
  // l'utilisateur, il ne se passerait rien.
  await nextTick()
  document.getElementById('sqlsources-confirmation')?.scrollIntoView({ block: 'center' })
}

const { confirm } = useDialogs()</script>

<template>
  <AdminPanel
    id="sqlsources-panel"
    title="Sources SQL"
    subtitle="requêtes PostgreSQL/MySQL indexées, réconciliées à chaque passage"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError"
      id="sqlsources-erreur"
      type="error"
      small
      :description="actionError"
      class="fr-mb-2w"
    />

    <DsfrAlert
      v-if="actionMessage"
      id="sqlsources-confirmation"
      type="success"
      small
      :description="actionMessage"
      class="fr-mb-2w"
    />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="sqlsources-tableau">
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Libellé</th>
            <th scope="col">Index ES</th>
            <th scope="col">Intervalle</th>
            <th scope="col">Description</th>
            <th scope="col">Facettes</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!Object.keys(data?.sources || {}).length">
            <td colspan="7" class="fr-hint-text">Aucune source SQL.</td>
          </tr>
          <tr v-for="(source, name) in data?.sources || {}" :key="name" data-testid="sqlsources-ligne" :data-source="name">
            <td><code>{{ name }}</code></td>
            <td>{{ source.label || '' }}</td>
            <td><code>{{ source.es_index }}</code></td>
            <td>{{ source.poll_interval_seconds }} s</td>
            <td>{{ source.description || '' }}</td>
            <td>{{ facetLabels(source) }}</td>
            <td class="ds-admin__actions">
              <DsfrButton
                size="sm"
                secondary
                label="Modifier"
                data-testid="sqlsources-modifier"
                @click="openForm(String(name), source)"
              />
              <DsfrButton
                size="sm"
                tertiary
                label="Retirer"
                data-testid="sqlsources-retirer"
                @click="removeSource(String(name))"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Le bouton ne s'efface plus derrière le formulaire : celui-ci
         s'ouvre en modale, par-dessus le panneau. Le `v-if` sur la
         modale, lui, reste la remise à zéro du formulaire d'une
         ouverture à l'autre (voir AdminSqlSourceForm). -->
    <DsfrButton
      id="sqlsources-nouvelle"
      class="fr-mt-2w"
      size="sm"
      secondary
      label="+ Nouvelle source SQL"
      @click="openForm(null)"
    />
    <AdminSqlSourceForm
      v-if="editing"
      :key="editing.name || 'nouvelle'"
      :name="editing.name || undefined"
      :source="editing.source"
      :dsns="data?.dsns || []"
      @saved="onSaved"
      @cancel="editing = null"
    />

    <h3 id="sqlsources-dsn-titre" class="fr-h6 fr-mt-3w">DSN chiffrés</h3>
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="sqlsources-dsn-tableau">
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Indice (schéma et hôte, sans identifiants)</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.dsns.length">
            <td colspan="3" class="fr-hint-text">Aucun DSN enregistré ici.</td>
          </tr>
          <tr v-for="dsn in data?.dsns || []" :key="dsn.name" data-testid="sqlsources-dsn-ligne" :data-dsn="dsn.name">
            <td><code>{{ dsn.name }}</code></td>
            <td>{{ dsn.hint }}</td>
            <td>
              <DsfrButton
                size="sm"
                tertiary
                label="Retirer"
                data-testid="sqlsources-dsn-retirer"
                @click="removeDsn(dsn.name)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="ds-admin__row fr-mt-2w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-dsn-name">Nom du DSN</label>
        <input
          id="new-dsn-name"
          v-model="dsnName"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="nom (ex : CLIENTS_PG_DSN)"
        />
      </div>
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-dsn-value">DSN complet</label>
        <!-- type=password : le DSN contient un mot de passe en clair, il
             ne doit pas rester lisible à l'écran pendant la saisie. -->
        <input
          id="new-dsn-value"
          v-model="dsnValue"
          class="fr-input fr-input--sm"
          type="password"
          autocomplete="off"
          placeholder="postgresql+psycopg2://user:motdepasse@host:5432/db"
        />
      </div>
      <DsfrButton id="sqlsources-dsn-enregistrer" size="sm" label="Enregistrer le DSN" @click="addDsn" />
    </div>

    <p class="fr-hint-text fr-mt-2w">
      Alternative à une variable d'environnement : ce DSN est chiffré (Fernet) puis stocké dans
      Redis, sans redémarrage de conteneur ni accès SSH. Il n'est plus jamais réaffiché après
      enregistrement — seul l'indice ci-dessus (schéma et hôte, jamais les identifiants) reste
      consultable. Nécessite <code>DSN_ENCRYPTION_KEY</code> côté API et ingestion.
    </p>
  </AdminPanel>
</template>
