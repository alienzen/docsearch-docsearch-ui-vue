<script setup lang="ts">
/**
 * Types de fichiers indexés, PAR SOURCE : chaque source fichier a sa
 * propre configuration d'extensions.
 */
import { ref, watch } from 'vue'
import {
  deleteFiletype,
  getFiletypes,
  resetFiletypes,
  saveFiletype,
  type FiletypeRule,
} from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useSaveHint } from '@/composables/useSaveHint'

const props = defineProps<{ sources: string[] }>()

const selected = ref('documents')
const newExt = ref('')
const newSize = ref('')
const actionError = ref<string | null>(null)

const { data, error, refresh } = useStatsPanel(() => getFiletypes(selected.value))
const { saved, flash } = useSaveHint()

/** Copie éditable, remplacée à chaque chargement. */
const rules = ref<Record<string, FiletypeRule>>({})
watch(data, (cfg) => {
  if (cfg) rules.value = JSON.parse(JSON.stringify(cfg))
})

// Si la source sélectionnée disparaît (source supprimée ailleurs), on
// retombe sur « documents », comme en vanilla.
watch(
  () => props.sources,
  (list) => {
    if (list.length && !list.includes(selected.value)) selected.value = list[0]
  },
)

watch(selected, refresh)

async function run(action: () => Promise<unknown>, then?: () => void) {
  actionError.value = null
  try {
    await action()
    then?.()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

function save(ext: string) {
  const rule = rules.value[ext]
  return run(
    () =>
      saveFiletype(ext, {
        enabled: rule.enabled,
        max_size_mb: rule.max_size_mb ?? null,
        source: selected.value,
      }),
    () => flash(ext),
  )
}

function remove(ext: string) {
  if (
    !confirm(
      `Supprimer l'extension .${ext} (source « ${selected.value} ») ? Elle ne sera plus indexée pour cette source.`,
    )
  )
    return
  return run(() => deleteFiletype(ext, selected.value), refresh)
}

function add() {
  const ext = newExt.value.trim().replace(/^\./, '')
  if (!ext) return
  const size = parseFloat(newSize.value)
  return run(
    () =>
      saveFiletype(ext, {
        enabled: true,
        max_size_mb: Number.isFinite(size) ? size : null,
        source: selected.value,
      }),
    () => {
      newExt.value = ''
      newSize.value = ''
      refresh()
    },
  )
}

function resetAll() {
  if (
    !confirm(
      `Charger les extensions par défaut pour la source « ${selected.value} » ? Toute extension ajoutée et tout réglage personnalisé seront écrasés pour cette source.`,
    )
  )
    return
  return run(() => resetFiletypes(selected.value), refresh)
}
</script>

<template>
  <AdminPanel
    id="filetypes-panel"
    title="Types de fichiers"
    subtitle="par source — chaque source a sa propre configuration"
    :error="error"
  >
    <DsfrAlert v-if="actionError" type="error" small :description="actionError" class="fr-mb-2w" />

    <div class="fr-select-group ds-admin__source-select">
      <label class="fr-label" for="filetype-source">Source</label>
      <select id="filetype-source" v-model="selected" class="fr-select fr-select--sm">
        <option v-for="source in sources" :key="source" :value="source">{{ source }}</option>
      </select>
    </div>

    <div class="fr-table fr-table--bordered ds-stats__table fr-mt-2w">
      <table>
        <thead>
          <tr>
            <th scope="col">Extension</th>
            <th scope="col">Activé</th>
            <th scope="col">Taille max (Mo)</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(rule, ext) in rules" :key="ext">
            <td><code>{{ ext }}</code></td>
            <td>
              <div class="fr-checkbox-group fr-checkbox-group--sm">
                <input :id="`ft-${ext}`" v-model="rule.enabled" type="checkbox" />
                <label class="fr-label" :for="`ft-${ext}`">
                  <span class="fr-sr-only">Indexer les fichiers {{ ext }}</span>
                </label>
              </div>
            </td>
            <td>
              <input
                v-model.number="rule.max_size_mb"
                class="fr-input fr-input--sm"
                type="number"
                min="0"
                step="1"
                :aria-label="`Taille maximale pour ${ext}`"
              />
            </td>
            <td class="ds-admin__actions">
              <DsfrButton size="sm" secondary label="Enregistrer" @click="save(String(ext))" />
              <span v-if="saved === ext" class="fr-hint-text fr-mb-0">✓ enregistré</span>
              <!-- « default » est la règle de repli : la supprimer
                   laisserait les extensions inconnues sans consigne. -->
              <DsfrButton
                v-if="ext !== 'default'"
                size="sm"
                tertiary
                label="Supprimer"
                @click="remove(String(ext))"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="ds-admin__row fr-mt-2w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-ext">Nouvelle extension</label>
        <input
          id="new-ext"
          v-model="newExt"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="nouvelle extension (ex : jpg)"
          @keydown.enter.prevent="add"
        />
      </div>
      <div class="fr-input-group fr-mb-0 ds-admin__narrow">
        <label class="fr-label fr-sr-only" for="new-ext-size">Taille max (Mo)</label>
        <input
          id="new-ext-size"
          v-model="newSize"
          class="fr-input fr-input--sm"
          type="number"
          placeholder="Mo"
        />
      </div>
      <DsfrButton size="sm" label="Ajouter" @click="add" />
      <DsfrButton
        size="sm"
        secondary
        label="Charger les extensions par défaut"
        @click="resetAll"
      />
    </div>
  </AdminPanel>
</template>
