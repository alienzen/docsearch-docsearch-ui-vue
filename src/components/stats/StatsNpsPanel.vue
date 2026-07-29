<script setup lang="ts">
/** Score NPS et répartition promoteurs / passifs / détracteurs. */
import { getNpsSummary } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'

const { data, error } = useStatsPanel(getNpsSummary)
</script>

<template>
  <StatsPanel
    id="nps-panel"
    title="NPS"
    subtitle="recommanderiez-vous DocSearch à un collègue ?"
    :error="error"
  >
    <div v-if="data" class="ds-stats__cards">
      <div class="ds-stats__card">
        <p class="fr-hint-text fr-mb-0">Score NPS</p>
        <p class="ds-stats__value">{{ data.nps_score ?? '—' }}</p>
        <p class="fr-hint-text fr-mb-0">{{ data.total_responses }} réponse(s)</p>
      </div>
      <div class="ds-stats__card">
        <p class="fr-hint-text fr-mb-0">Promoteurs (9-10)</p>
        <p class="ds-stats__value">{{ data.promoters }}</p>
      </div>
      <div class="ds-stats__card">
        <p class="fr-hint-text fr-mb-0">Passifs (7-8)</p>
        <p class="ds-stats__value">{{ data.passives }}</p>
      </div>
      <div class="ds-stats__card">
        <p class="fr-hint-text fr-mb-0">Détracteurs (0-6)</p>
        <p class="ds-stats__value">{{ data.detractors }}</p>
      </div>
    </div>
  </StatsPanel>
</template>
