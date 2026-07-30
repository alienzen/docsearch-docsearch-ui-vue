<script setup lang="ts">
/** Suggestions libres, avec changement de statut. */
import { ref, watch } from 'vue'
import { getSuggestions, setSuggestionStatus, type Suggestion } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { fmtDateTime } from '@/utils/format'

const PAGE_SIZE = 20
const CATEGORY_LABELS: Record<string, string> = { bug: 'Bug', idea: 'Idée', other: 'Autre' }
const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  traite: 'Traité',
}

const from = ref(0)
const statusError = ref<string | null>(null)

const { data, error, refresh } = useStatsPanel(() => getSuggestions(PAGE_SIZE, from.value))

watch(from, refresh)

async function updateStatus(suggestion: Suggestion, status: string) {
  const before = suggestion.status
  suggestion.status = status
  statusError.value = null
  try {
    await setSuggestionStatus(suggestion.id, status)
  } catch (e) {
    suggestion.status = before
    statusError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <StatsPanel
    id="suggestions-panel"
    title="Suggestions"
    subtitle="recueillies via « Suggérer une idée » — anonymes par défaut"
    :error="error"
  >
    <DsfrAlert v-if="statusError" type="error" small :description="statusError" class="fr-mb-2w" />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table>
        <thead>
          <tr>
            <th scope="col">Date / heure</th>
            <th scope="col">Catégorie</th>
            <th scope="col">Suggestion</th>
            <th scope="col">Utilisateur</th>
            <th scope="col">Statut</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.results.length">
            <td colspan="5" class="fr-hint-text">Aucune suggestion pour l'instant.</td>
          </tr>
          <tr v-for="suggestion in data?.results || []" :key="suggestion.id">
            <td>{{ fmtDateTime(suggestion.timestamp) }}</td>
            <td>{{ CATEGORY_LABELS[suggestion.category || ''] || '—' }}</td>
            <td>{{ suggestion.text }}</td>
            <td>
              <span v-if="suggestion.username">{{ suggestion.username }}</span>
              <span v-else class="fr-hint-text">Anonyme</span>
            </td>
            <td>
              <select
                class="fr-select fr-select--sm"
                :aria-label="`Statut de la suggestion du ${fmtDateTime(suggestion.timestamp)}`"
                :value="suggestion.status || 'nouveau'"
                @change="updateStatus(suggestion, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </td>
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

    <StatsGroupCounts
      v-if="data"
      :rows="data.by_group"
      title="Suggestions par groupe"
      count-label="Suggestions"
    >
      <template #note>
        « Non renseigné » réunit les suggestions déposées ANONYMEMENT — dont
        c'est le principe même — et celles antérieures à la capture des
        groupes ; les deux ne peuvent pas être distinguées sans percer
        l'anonymat.
      </template>
    </StatsGroupCounts>
  </StatsPanel>
</template>
