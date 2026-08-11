<script setup lang="ts">
/** Vue d'ensemble : compteurs et recherches par jour. */
import { computed } from 'vue'
import { getSummary, groupLabel } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'

const { data, error } = useStatsPanel(getSummary)

/**
 * Groupes ayant émis au moins un avis, les plus actifs d'abord. Le
 * pourcentage est recalculé par groupe : il ne se déduit pas du taux
 * global, les volumes différant d'un groupe à l'autre.
 */
const avisParGroupe = computed(() =>
  [...(data.value?.by_group || [])]
    .map((g) => {
      const total = g.feedback_up + g.feedback_down
      return { ...g, total, pct: total ? Math.round((g.feedback_up / total) * 100) : null }
    })
    .sort((a, b) => b.total - a.total),
)

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
      <div id="summary-cartes" class="ds-stats__cards">
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
        <ul id="summary-histogramme" class="ds-stats__bars">
          <li
            v-for="day in data.by_day"
            :key="day.date"
            class="ds-stats__bar"
            data-testid="summary-jour"
            :data-jour="day.date"
          >
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

    <StatsGroupCounts
      v-if="data"
      id="summary-groupes"
      :rows="data.searches_by_group"
      title="Recherches par groupe"
      count-label="Recherches"
    >
      <template #note>
        « Non renseigné » regroupe les recherches antérieures à la capture des
        groupes.
      </template>
    </StatsGroupCounts>

    <template v-if="avisParGroupe.length">
      <h3 id="summary-avis-groupes-titre" class="fr-h6 fr-mt-3w">Avis par groupe</h3>
      <div class="fr-table fr-table--bordered ds-stats__table">
        <table id="summary-avis-groupes">
          <thead>
            <tr>
              <th scope="col">Groupe</th>
              <th scope="col">Avis</th>
              <th scope="col">Positifs</th>
              <th scope="col">Négatifs</th>
              <th scope="col">Part positive</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in avisParGroupe" :key="g.group" data-testid="summary-avis-groupe">
              <td>{{ groupLabel(g.group) }}</td>
              <td>{{ g.total }}</td>
              <td>
                <span class="fr-icon-thumb-up-line fr-icon--sm" aria-hidden="true" />
                {{ g.feedback_up }}
              </td>
              <td>
                <span class="fr-icon-thumb-down-line fr-icon--sm" aria-hidden="true" />
                {{ g.feedback_down }}
              </td>
              <td>{{ g.pct !== null ? `${g.pct} %` : '—' }}</td>
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
