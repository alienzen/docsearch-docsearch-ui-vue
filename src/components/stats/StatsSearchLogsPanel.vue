<script setup lang="ts">
/** Historique des recherches, filtrable et exportable. */
import { ref, watch } from 'vue'
import { getSearchLogs, searchLogsExportUrl, type SearchLogEntry } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { extLabel, fmtDateTime, fmtDuration } from '@/utils/format'

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

/**
 * Icône DSFR et libellé lisible, plutôt que les émojis d'origine : ceux-ci
 * changent de dessin d'un système à l'autre et servaient de seul contenu
 * de la cellule — donc de seule information pour un lecteur d'écran, qui
 * annonçait « pouce vers le haut » au lieu de l'avis.
 */
const FEEDBACK_LABELS: Record<string, { icone: string; texte: string }> = {
  up: { icone: 'fr-icon-thumb-up-line', texte: 'Positif' },
  down: { icone: 'fr-icon-thumb-down-line', texte: 'Négatif' },
}

/**
 * Nombre de documents ouverts depuis cette recherche — clics effacés
 * COMPRIS.
 *
 * Quand l'utilisateur efface ses documents consultés, le détail de ses
 * clics est supprimé du journal et seul leur nombre subsiste
 * (`clicks_erased`, voir history_purge.py). Ne compter que `clicks`
 * ferait passer pour infructueuse une recherche qui a mené à trois
 * consultations : la mention « dont N effacés » dit pourquoi le détail
 * manque, plutôt que de laisser croire à un défaut de collecte.
 */
function clics(entry: SearchLogEntry): string {
  const detailles = (entry.clicks || []).length
  const effaces = entry.clicks_erased || 0
  if (!detailles && !effaces) return '—'
  if (!effaces) return String(detailles)
  return `${detailles + effaces} (dont ${effaces} effacé${effaces > 1 ? 's' : ''})`
}
</script>

<template>
  <StatsPanel id="logs-panel" title="Historique des recherches" :error="error">
    <div id="logs-filtres" class="ds-stats__filters fr-mb-2w">
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
      <DsfrButton id="logs-filtrer" size="sm" label="Filtrer" @click="applyFilter" />
      <DsfrButton
        id="logs-reinitialiser"
        size="sm"
        secondary
        label="Réinitialiser"
        @click="resetFilter"
      />
      <!-- L'export couvre TOUTES les lignes correspondant au filtre, pas
           la page affichée ; Content-Disposition déclenche le
           téléchargement sans quitter la page. -->
      <a
        id="logs-export"
        class="fr-btn fr-btn--secondary fr-btn--sm"
        :href="searchLogsExportUrl(query)"
        target="_blank"
        rel="noopener"
      >
        Exporter en XLS
      </a>
    </div>

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="logs-tableau">
        <thead>
          <tr>
            <th scope="col">Date / heure</th>
            <th scope="col">Requête</th>
            <th scope="col">Source</th>
            <th scope="col">Critères</th>
            <th scope="col">Résultats</th>
            <th scope="col">Durée</th>
            <th scope="col">Documents retournés</th>
            <th scope="col">Avis</th>
            <th scope="col">Clics</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.results.length">
            <td colspan="9" class="fr-hint-text">Aucune recherche ne correspond à ces critères.</td>
          </tr>
          <tr v-for="entry in data?.results || []" :key="entry.id" data-testid="log-ligne">
            <td>{{ fmtDateTime(entry.timestamp) }}</td>
            <td>{{ entry.query }}</td>
            <td>{{ asList(entry.source).join(', ') || 'toutes' }}</td>
            <td>{{ criteria(entry) }}</td>
            <td>{{ entry.total_results ?? 0 }}</td>
            <!-- « — » pour les recherches antérieures à la mesure : elles
                 n'ont pas de durée, ce n'est pas une durée nulle. Le
                 détail moteur/traitement va au survol plutôt qu'en
                 colonne, le tableau étant déjà large. -->
            <td :title="entry.took_ms !== undefined ? `dont moteur ${fmtDuration(entry.took_ms)}` : ''">
              {{ fmtDuration(entry.duration_ms) }}
            </td>
            <td>{{ resultFiles(entry.result_files) }}</td>
            <td>
              <template v-if="FEEDBACK_LABELS[entry.feedback || '']">
                <span
                  :class="[FEEDBACK_LABELS[entry.feedback || ''].icone, 'fr-icon--sm']"
                  aria-hidden="true"
                />
                {{ FEEDBACK_LABELS[entry.feedback || ''].texte }}
              </template>
              <template v-else>—</template>
            </td>
            <td>{{ clics(entry) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <StatsPager
      id="logs-pagination"
      :from="from"
      :page-size="PAGE_SIZE"
      :total="data?.total || 0"
      @update:from="from = $event"
    />
  </StatsPanel>
</template>
