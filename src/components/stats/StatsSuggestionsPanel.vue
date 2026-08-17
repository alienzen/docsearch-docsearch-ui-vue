<script setup lang="ts">
/** Suggestions libres, avec changement de statut et suppression. */
import { ref, watch } from 'vue'
import { deleteSuggestion, getSuggestions, setSuggestionStatus, type Suggestion } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useDialogs } from '@/composables/useDialogs'
import { fmtDateTime } from '@/utils/format'

const PAGE_SIZE = 20
const CATEGORY_LABELS: Record<string, string> = { bug: 'Bug', idea: 'Idée', other: 'Autre' }
const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  traite: 'Traité',
}

/** Extrait cité dans la demande de confirmation, sans la noyer. */
const EXTRAIT_MAX = 120

const from = ref(0)
const statusError = ref<string | null>(null)

const { confirm } = useDialogs()
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

function extrait(texte: string): string {
  return texte.length > EXTRAIT_MAX ? `${texte.slice(0, EXTRAIT_MAX)}…` : texte
}

/**
 * Suppression définitive, d'où la confirmation citant le texte : une
 * suggestion anonyme ne peut plus être retrouvée ni redemandée à son
 * auteur, contrairement à une source ou un synonyme qu'on peut resaisir.
 *
 * Le rechargement est complet plutôt que le simple retrait de la ligne
 * du tableau : la page affichée est une PAGE d'une liste paginée, dont
 * le total et le décompte par groupe changent aussi. Et si la ligne
 * effacée était la dernière de la dernière page, on recule d'une page
 * plutôt que de laisser un tableau vide sous un total non nul.
 */
async function supprimer(suggestion: Suggestion) {
  // Message d'une seule ligne : AppDialogs.vue le rend dans un <p>, où
  // un saut de ligne serait avalé par HTML.
  const ok = await confirm(
    `Supprimer définitivement la suggestion « ${extrait(suggestion.text)} » ? Cette action est irréversible.`,
    { title: 'Supprimer la suggestion', confirmLabel: 'Supprimer' },
  )
  if (!ok) return
  statusError.value = null
  try {
    await deleteSuggestion(suggestion.id)
  } catch (e) {
    statusError.value = e instanceof Error ? e.message : String(e)
    return
  }
  if (from.value > 0 && data.value?.results.length === 1) {
    from.value -= PAGE_SIZE // `watch(from)` recharge
    return
  }
  await refresh()
}
</script>

<template>
  <StatsPanel
    id="suggestions-panel"
    title="Suggestions"
    subtitle="recueillies via « Suggérer une idée » — anonymes par défaut"
    :error="error"
  >
    <DsfrAlert
      v-if="statusError"
      id="suggestions-erreur-statut"
      type="error"
      small
      :description="statusError"
      class="fr-mb-2w"
    />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="suggestions-tableau">
        <thead>
          <tr>
            <th scope="col">Date / heure</th>
            <th scope="col">Catégorie</th>
            <th scope="col">Suggestion</th>
            <th scope="col">Utilisateur</th>
            <th scope="col">Statut</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.results.length">
            <td colspan="6" class="fr-hint-text">Aucune suggestion pour l'instant.</td>
          </tr>
          <tr
            v-for="suggestion in data?.results || []"
            :key="suggestion.id"
            data-testid="suggestion-ligne"
            :data-suggestion-id="suggestion.id"
          >
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
                data-testid="suggestion-statut"
                :aria-label="`Statut de la suggestion du ${fmtDateTime(suggestion.timestamp)}`"
                :value="suggestion.status || 'nouveau'"
                @change="updateStatus(suggestion, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="(label, value) in STATUS_LABELS" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </td>
            <td>
              <DsfrButton
                size="sm"
                secondary
                label="Supprimer"
                data-testid="suggestion-supprimer"
                :aria-label="`Supprimer la suggestion du ${fmtDateTime(suggestion.timestamp)}`"
                @click="supprimer(suggestion)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <StatsPager
      id="suggestions-pagination"
      :from="from"
      :page-size="PAGE_SIZE"
      :total="data?.total || 0"
      @update:from="from = $event"
    />

    <StatsGroupCounts
      v-if="data"
      id="suggestions-groupes"
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
