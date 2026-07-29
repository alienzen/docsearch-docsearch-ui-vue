<script setup lang="ts">
/** Historique des recherches, filtrable et exportable. */
import { ref, watch } from 'vue'
import { getSearchLogs, searchLogsExportUrl, type SearchLogEntry } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { extLabel, fmtDateTime } from '@/utils/format'

const PAGE_SIZE = 50

const from = ref(0)
/** Filtre appliqué, distinct de la saisie en cours. */
const query = ref('')
const input = ref('')

const { data, error, refresh } = useStatsPanel(() =>
  getSearchLogs(PAGE_SIZE, from.value, query.value),
)

watch([from, query], refresh)

function applyFilter() {
  from.value = 0
  query.value = input.value.trim()
}

function resetFilter() {
  input.value = ''
  from.value = 0
  query.value = ''
}

/** extension/author/folder : liste, ou chaîne unique pour les vieilles lignes. */
function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

/** Résumé des filtres actifs au moment de la recherche. */
function criteria(entry: SearchLogEntry): string {
  const tags: string[] = []
  const exts = asList(entry.extension)
  if (exts.length) tags.push(exts.map(extLabel).join(', '))
  const authors = asList(entry.author)
  if (authors.length) tags.push(`Auteur : ${authors.join(', ')}`)
  const folders = asList(entry.folder)
  if (folders.length) tags.push(`Dossier : ${folders.join(', ')}`)
  if (entry.date_from || entry.date_to) {
    tags.push(`Période : ${entry.date_from || '…'} → ${entry.date_to || '…'}`)
  }
  return tags.join(' · ') || '—'
}

/** Les 3 premiers documents retournés, puis « +N ». */
function resultFiles(files: string[] | undefined): string {
  if (!files?.length) return '—'
  const shown = files.filter(Boolean).slice(0, 3)
  const rest = files.length - shown.length
  return shown.join(', ') + (rest > 0 ? ` +${rest}` : '')
}

const FEEDBACK_LABELS: Record<string, string> = { up: '👍', down: '👎' }
</script>

<template>
  <StatsPanel id="logs-panel" title="Historique des recherches" :error="error">
    <div class="ds-stats__filters fr-mb-2w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="logs-filter">Filtrer par mot-clé</label>
        <input
          id="logs-filter"
          v-model="input"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="Filtrer par mot-clé de la requête"
          @keydown.enter.prevent="applyFilter"
        />
      </div>
      <DsfrButton size="sm" label="Filtrer" @click="applyFilter" />
      <DsfrButton size="sm" secondary label="Réinitialiser" @click="resetFilter" />
      <!-- L'export couvre TOUTES les lignes correspondant au filtre, pas
           la page affichée ; Content-Disposition déclenche le
           téléchargement sans quitter la page. -->
      <a
        class="fr-btn fr-btn--secondary fr-btn--sm"
        :href="searchLogsExportUrl(query)"
        target="_blank"
        rel="noopener"
      >
        Exporter en XLS
      </a>
    </div>

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table>
        <thead>
          <tr>
            <th scope="col">Date / heure</th>
            <th scope="col">Requête</th>
            <th scope="col">Source</th>
            <th scope="col">Critères</th>
            <th scope="col">Résultats</th>
            <th scope="col">Documents retournés</th>
            <th scope="col">Avis</th>
            <th scope="col">Clics</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.results.length">
            <td colspan="8" class="fr-hint-text">Aucune recherche ne correspond à ces critères.</td>
          </tr>
          <tr v-for="entry in data?.results || []" :key="entry.id">
            <td>{{ fmtDateTime(entry.timestamp) }}</td>
            <td>{{ entry.query }}</td>
            <td>{{ asList(entry.source).join(', ') || 'toutes' }}</td>
            <td>{{ criteria(entry) }}</td>
            <td>{{ entry.total_results ?? 0 }}</td>
            <td>{{ resultFiles(entry.result_files) }}</td>
            <td>{{ FEEDBACK_LABELS[entry.feedback || ''] || '—' }}</td>
            <td>{{ (entry.clicks || []).length || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <StatsPager
      :from="from"
      :page-size="PAGE_SIZE"
      :total="data?.total || 0"
      @update:from="from = $event"
    />
  </StatsPanel>
</template>
