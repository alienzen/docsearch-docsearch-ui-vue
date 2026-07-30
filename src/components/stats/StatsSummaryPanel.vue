<script setup lang="ts">
/** Vue d'ensemble : compteurs et recherches par jour. */
import { computed } from 'vue'
import { getSummary } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'

const { data, error } = useStatsPanel(getSummary)

const feedbackTotal = computed(() =>
  data.value ? data.value.feedback_up + data.value.feedback_down : 0,
)
const feedbackPct = computed(() =>
  data.value && feedbackTotal.value
    ? Math.round((data.value.feedback_up / feedbackTotal.value) * 100)
    : null,
)
/** Hauteur des barres, en % de la journée la plus chargée. */
const maxCount = computed(() => Math.max(1, ...(data.value?.by_day || []).map((b) => b.count)))
</script>

<template>
  <StatsPanel id="summary-panel" title="Vue d'ensemble" :error="error">
    <div v-if="data">
      <div class="ds-stats__cards">
        <div class="ds-stats__card">
          <p class="fr-hint-text fr-mb-0">Recherches effectuées</p>
          <p class="ds-stats__value">{{ data.total_searches.toLocaleString('fr-FR') }}</p>
        </div>
        <div class="ds-stats__card">
          <p class="fr-hint-text fr-mb-0">Utilisateurs distincts</p>
          <p class="ds-stats__value">{{ data.unique_users }}</p>
        </div>
        <div class="ds-stats__card">
          <p class="fr-hint-text fr-mb-0">Avis positifs</p>
          <p class="ds-stats__value">{{ feedbackPct !== null ? `${feedbackPct} %` : '—' }}</p>
          <p class="fr-hint-text fr-mb-0">
            <!-- Icônes DSFR plutôt que les émojis, comme sur la barre
                 d'avis de la recherche : elles suivent le thème et ne
                 changent pas de dessin d'un système à l'autre. Le sens
                 est porté par le texte lu à côté, l'icône n'est que
                 décorative — d'où `aria-hidden`. -->
            {{ feedbackTotal }} avis (<span
              class="fr-icon-thumb-up-line fr-icon--sm"
              aria-hidden="true"
            />
            {{ data.feedback_up }} positifs /
            <span class="fr-icon-thumb-down-line fr-icon--sm" aria-hidden="true" />
            {{ data.feedback_down }} négatifs)
          </p>
        </div>
      </div>

      <template v-if="data.by_day.length">
        <p class="fr-hint-text fr-mt-2w fr-mb-1v">Recherches par jour (14 derniers jours)</p>
        <ul class="ds-stats__bars">
          <li v-for="day in data.by_day" :key="day.date" class="ds-stats__bar">
            <span class="ds-stats__bar-count">{{ day.count }}</span>
            <span
              class="ds-stats__bar-fill"
              :style="{ height: `${Math.round((day.count / maxCount) * 100)}%` }"
            />
            <span class="ds-stats__bar-label">{{ day.date.slice(5) }}</span>
          </li>
        </ul>
      </template>
      <p v-else class="fr-hint-text">Aucune recherche enregistrée pour l'instant.</p>
    </div>
  </StatsPanel>
</template>
