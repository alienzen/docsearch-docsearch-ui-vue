<script setup lang="ts">
/**
 * Journal d'audit des actions d'administration.
 *
 * « Route » / « Cible » / « Détails » reflètent directement la requête
 * HTTP plutôt qu'une reformulation en français par type d'action : une
 * route jamais vue encore reste lisible, là où une table de libellés
 * prendrait forcément du retard sur les routes /admin/* réelles.
 */
import { ref, watch } from 'vue'
import { getAuditLog } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { fmtDateTime } from '@/utils/format'

const PAGE_SIZE = 30

const from = ref(0)
const { data, error, refresh } = useStatsPanel(() => getAuditLog(PAGE_SIZE, from.value))

watch(from, refresh)

function pathParams(params: Record<string, unknown> | undefined): string {
  if (!params || !Object.keys(params).length) return '—'
  return Object.values(params).map(String).join(', ')
}

function body(value: Record<string, unknown> | undefined): string {
  if (!value || !Object.keys(value).length) return '—'
  return Object.entries(value)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ')
}
</script>

<template>
  <StatsPanel
    id="audit-log-panel"
    title="Journal d'audit"
    subtitle="actions d'administration réussies, les plus récentes en premier"
    :error="error"
  >
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="audit-log-tableau">
        <thead>
          <tr>
            <th scope="col">Date / heure</th>
            <th scope="col">Utilisateur</th>
            <th scope="col">Méthode</th>
            <th scope="col">Route</th>
            <th scope="col">Cible</th>
            <th scope="col">Détails</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.results.length">
            <td colspan="6" class="fr-hint-text">Aucune action enregistrée pour l'instant.</td>
          </tr>
          <tr v-for="entry in data?.results || []" :key="entry.id" data-testid="audit-ligne">
            <td>{{ fmtDateTime(entry.timestamp) }}</td>
            <td>{{ entry.username }}</td>
            <td>{{ entry.method }}</td>
            <td><code>{{ (entry.path || '').replace(/^\/admin\//, '') }}</code></td>
            <td>{{ pathParams(entry.path_params) }}</td>
            <td>{{ body(entry.body) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <StatsPager
      id="audit-log-pagination"
      :from="from"
      :page-size="PAGE_SIZE"
      :total="data?.total || 0"
      @update:from="from = $event"
    />
  </StatsPanel>
</template>
