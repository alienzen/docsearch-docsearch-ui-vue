<script setup lang="ts">
/** Score NPS et répartition promoteurs / passifs / détracteurs. */
import { computed } from 'vue'
import { getNpsSummary, groupLabel } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'

const { data, error } = useStatsPanel(getNpsSummary)

/** Les groupes les plus représentatifs d'abord. */
const parGroupe = computed(() =>
  [...(data.value?.by_group || [])].sort((a, b) => b.responses - a.responses),
)
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

    <template v-if="parGroupe.length">
      <h3 class="fr-h6 fr-mt-3w">Score par groupe</h3>
      <div class="fr-table fr-table--bordered ds-stats__table">
        <table>
          <thead>
            <tr>
              <th scope="col">Groupe</th>
              <th scope="col">Réponses</th>
              <th scope="col">Score</th>
              <th scope="col">Promoteurs</th>
              <th scope="col">Passifs</th>
              <th scope="col">Détracteurs</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in parGroupe" :key="g.group">
              <td>{{ groupLabel(g.group) }}</td>
              <td>{{ g.responses }}</td>
              <td>{{ g.nps_score ?? '—' }}</td>
              <td>{{ g.promoters }}</td>
              <td>{{ g.passives }}</td>
              <td>{{ g.detractors }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="fr-hint-text fr-mt-1w">
        Un utilisateur appartenant à plusieurs groupes compte dans chacun : la
        somme des lignes dépasse donc le total. « Non renseigné » regroupe les
        enregistrements antérieurs à la capture des groupes et les utilisateurs
        sans appartenance.
      </p>
      <p class="fr-hint-text">
        Aucun effectif minimum n'est appliqué : dans un groupe très restreint,
        ces chiffres peuvent désigner une personne.
      </p>
    </template>
  </StatsPanel>
</template>
