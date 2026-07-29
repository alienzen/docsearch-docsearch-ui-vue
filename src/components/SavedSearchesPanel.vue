<script setup lang="ts">
/**
 * Panneau « Mes recherches ». Portage de
 * docsearch-ui/public/js/saved-searches.js (hors alertes, voir
 * AlertsPanel).
 */
import { ref } from 'vue'
import {
  deleteSavedSearch,
  extList,
  listSavedSearches,
  setAlert,
  toArray,
  type SavedSearch,
} from '@/api/savedSearches'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { extLabel } from '@/utils/format'
import { SEARCH_IN_LABELS, SORT_LABELS } from '@/constants'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const list = ref<SavedSearch[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const menu = ref<{ close: () => void } | null>(null)

/** Chargé à l'ouverture du menu, pas au montage de la page. */
async function load() {
  loading.value = true
  error.value = null
  try {
    list.value = await listSavedSearches()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

/** Résumé des critères, en puces — portage de criteriaSummary(). */
function criteriaSummary(saved: SavedSearch): string[] {
  const tags: string[] = []
  const exts = extList(saved.ext)
  if (exts.length) tags.push(exts.map(extLabel).join(', '))
  if (saved.search_in && saved.search_in !== 'all') {
    tags.push(`Champ : ${SEARCH_IN_LABELS[saved.search_in] || saved.search_in}`)
  }
  const dimensions: [string, string | string[] | null | undefined][] = [
    ['Auteur', saved.author],
    ['Mots-clés', saved.keywords],
    ['Dossier', saved.folder],
    ['Source', saved.source],
  ]
  for (const [label, value] of dimensions) {
    const values = toArray(value)
    if (values.length) tags.push(`${label} : ${values.join(', ')}`)
  }
  // Hors d'une recherche en cours, aucun libellé humain n'est garanti
  // pour une facette personnalisée : le nom de champ brut sert de repli.
  for (const [field, values] of Object.entries(saved.custom || {})) {
    if (values?.length) {
      tags.push(`${uiConfig.customFacetLabels[field] || field} : ${values.join(', ')}`)
    }
  }
  if (saved.date_from || saved.date_to) {
    tags.push(`Période : ${saved.date_from || '…'} → ${saved.date_to || '…'}`)
  }
  if (saved.sort && saved.sort !== '_score') {
    tags.push(`Tri : ${SORT_LABELS[saved.sort] || saved.sort}`)
  }
  return tags
}

function apply(saved: SavedSearch) {
  menu.value?.close()
  store.applySavedSearch(saved)
}

async function remove(saved: SavedSearch) {
  if (!confirm(`Supprimer la recherche « ${saved.name} » ?`)) return
  try {
    list.value = await deleteSavedSearch(saved.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

/**
 * L'API attend toujours une fréquence, même à la désactivation : on
 * renvoie celle affichée. En cas d'échec, l'état local est remis
 * comme avant pour ne pas afficher une alerte qui n'existe pas.
 */
async function updateAlert(saved: SavedSearch, enabled: boolean, frequency: string) {
  const before = { enabled: saved.alert_enabled, frequency: saved.alert_frequency }
  saved.alert_enabled = enabled
  saved.alert_frequency = frequency
  try {
    await setAlert(saved.id, enabled, frequency)
  } catch (e) {
    saved.alert_enabled = before.enabled
    saved.alert_frequency = before.frequency
    error.value = e instanceof Error ? e.message : String(e)
  }
}

</script>

<template>
  <NavMenuItem ref="menu" label="Mes recherches" @open="load">
    <li v-if="loading" class="ds-menu__message">Chargement…</li>
    <li v-else-if="error" class="ds-menu__message">
      <DsfrAlert type="error" small :description="error" />
    </li>
    <li v-else-if="!list.length" class="ds-menu__message">Aucune recherche enregistrée.</li>

    <li v-for="saved in list" v-else :key="saved.id" class="ds-menu__entry">
      <button class="fr-nav__link ds-menu__button" @click="apply(saved)">
        <span class="ds-menu__name">{{ saved.name }}</span>
        <span class="fr-hint-text fr-mb-0">« {{ saved.query }} »</span>
      </button>

      <ul v-if="criteriaSummary(saved).length" class="fr-tags-group fr-px-2w">
        <li v-for="tag in criteriaSummary(saved)" :key="tag">
          <span class="fr-tag fr-tag--sm">{{ tag }}</span>
        </li>
      </ul>

      <!-- Bloc alerte hors du bouton qui relance la recherche : en
           vanilla il fallait un stopPropagation, ici la structure suffit. -->
      <div class="ds-menu__alert fr-px-2w">
        <div class="fr-checkbox-group fr-checkbox-group--sm">
          <input
            :id="`alert-${saved.id}`"
            type="checkbox"
            :checked="saved.alert_enabled"
            @change="
              updateAlert(
                saved,
                ($event.target as HTMLInputElement).checked,
                saved.alert_frequency || 'daily',
              )
            "
          />
          <label class="fr-label" :for="`alert-${saved.id}`">M'alerter</label>
        </div>
        <select
          class="fr-select fr-select--sm"
          :aria-label="`Fréquence de l'alerte pour ${saved.name}`"
          :disabled="!saved.alert_enabled"
          :value="saved.alert_frequency === 'weekly' ? 'weekly' : 'daily'"
          @change="updateAlert(saved, true, ($event.target as HTMLSelectElement).value)"
        >
          <option value="daily">tous les jours</option>
          <option value="weekly">toutes les semaines</option>
        </select>
        <DsfrButton
          size="sm"
          tertiary
          no-outline
          label="Supprimer"
          :title="`Supprimer ${saved.name}`"
          @click="remove(saved)"
        />
      </div>
    </li>
  </NavMenuItem>
</template>
