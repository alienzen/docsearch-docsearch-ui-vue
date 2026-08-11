<script setup lang="ts">
/**
 * Requêtes ayant retourné zéro résultat, les plus fréquentes d'abord.
 * Simple « top N », sans pagination : au-delà d'une cinquantaine de
 * requêtes distinctes, ce sont les plus fréquentes qui comptent, pas
 * l'exhaustivité.
 */
import { getZeroResults } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { fmtDateTime } from '@/utils/format'

const { data, error } = useStatsPanel(getZeroResults)
</script>

<template>
  <StatsPanel
    id="zero-results-panel"
    title="Recherches sans résultat"
    :subtitle="
      data ? `${data.total_zero_result_searches.toLocaleString('fr-FR')} recherche(s) au total` : ''
    "
    :error="error"
  >
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="zero-results-tableau">
        <thead>
          <tr>
            <th scope="col">Requête</th>
            <th scope="col">Occurrences</th>
            <th scope="col">Dernière fois</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.results.length">
            <td colspan="3" class="fr-hint-text">Aucune recherche sans résultat pour l'instant.</td>
          </tr>
          <tr v-for="row in data?.results || []" :key="row.query" data-testid="zero-result-ligne">
            <td>{{ row.query }}</td>
            <td>{{ row.count }}</td>
            <td>{{ fmtDateTime(row.last_seen) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <StatsGroupCounts
      v-if="data"
      id="zero-results-groupes"
      :rows="data.by_group"
      title="Recherches sans résultat par groupe"
      count-label="Recherches"
    >
      <template #note>
        « Non renseigné » regroupe les recherches antérieures à la capture des
        groupes.
      </template>
    </StatsGroupCounts>
  </StatsPanel>
</template>
