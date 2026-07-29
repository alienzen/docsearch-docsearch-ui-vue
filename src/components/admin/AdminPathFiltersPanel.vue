<script setup lang="ts">
/**
 * Filtres de sous-dossiers (motifs glob, relatifs au dossier de la
 * source) et purge de l'index.
 *
 * Liste noire : ces chemins ne sont jamais indexés. Liste blanche : si
 * elle n'est pas vide, SEULS ces chemins le sont.
 */
import { ref, watch } from 'vue'
import { addPathFilter, getPathFilters, purgePath, removePathFilter } from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'

const props = defineProps<{ sources: string[] }>()

const selected = ref('documents')
const pattern = ref('')
const actionError = ref<string | null>(null)

const { data, error, refresh } = useStatsPanel(() => getPathFilters(selected.value))

watch(selected, refresh)
watch(
  () => props.sources,
  (list) => {
    if (list.length && !list.includes(selected.value)) selected.value = list[0]
  },
)

async function run(action: () => Promise<unknown>) {
  actionError.value = null
  try {
    await action()
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

function add(kind: 'include' | 'exclude') {
  const value = pattern.value.trim()
  if (!value) return
  return run(async () => {
    await addPathFilter(kind, selected.value, value)
    pattern.value = ''
  })
}

function remove(value: string) {
  return run(() => removePathFilter(selected.value, value))
}

// ── Purge ───────────────────────────────────────────────────
const purgePattern = ref('')
/** Aperçu en cours : motif compté et nombre de documents concernés. */
const preview = ref<{ pattern: string; matched: number } | null>(null)
const purgeDone = ref<number | null>(null)
const purgeError = ref<string | null>(null)

async function runPreview() {
  const value = purgePattern.value.trim()
  if (!value) return
  preview.value = null
  purgeDone.value = null
  purgeError.value = null
  try {
    const res = await purgePath(selected.value, value, true)
    preview.value = { pattern: value, matched: res.matched }
  } catch (e) {
    purgeError.value = e instanceof Error ? e.message : String(e)
  }
}

async function confirmPurge() {
  // On repurge sur le motif EXACTEMENT compté par l'aperçu, pas sur le
  // contenu courant du champ : celui-ci a pu changer entre-temps, et on
  // supprimerait alors autre chose que ce qui a été annoncé.
  const target = preview.value
  if (!target) return
  if (
    !confirm(
      `Supprimer définitivement ${target.matched} document(s) de l'index ? Les fichiers sur le disque ne sont pas touchés.`,
    )
  )
    return
  purgeError.value = null
  try {
    const res = await purgePath(selected.value, target.pattern, false)
    purgeDone.value = res.matched
    preview.value = null
  } catch (e) {
    purgeError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AdminPanel
    id="pathfilters-panel"
    title="Filtres de sous-dossiers"
    subtitle="motifs glob, relatifs au dossier de la source"
    :error="error"
  >
    <DsfrAlert v-if="actionError" type="error" small :description="actionError" class="fr-mb-2w" />

    <div class="fr-select-group ds-admin__source-select">
      <label class="fr-label" for="filter-source">Source</label>
      <select id="filter-source" v-model="selected" class="fr-select fr-select--sm">
        <option v-for="source in sources" :key="source" :value="source">{{ source }}</option>
      </select>
    </div>

    <p class="fr-hint-text fr-mt-2w fr-mb-1v">Liste noire (exclus)</p>
    <ul v-if="data?.excluded.length" class="fr-tags-group">
      <li v-for="p in data.excluded" :key="p">
        <button class="fr-tag fr-tag--dismiss" :aria-label="`Retirer ${p}`" @click="remove(p)">
          {{ p }}
        </button>
      </li>
    </ul>
    <p v-else class="fr-hint-text">aucune</p>

    <p class="fr-hint-text fr-mt-2w fr-mb-1v">
      Liste blanche (si non vide, seuls ces chemins sont indexés)
    </p>
    <ul v-if="data?.included.length" class="fr-tags-group">
      <li v-for="p in data.included" :key="p">
        <button class="fr-tag fr-tag--dismiss" :aria-label="`Retirer ${p}`" @click="remove(p)">
          {{ p }}
        </button>
      </li>
    </ul>
    <p v-else class="fr-hint-text">aucune — tout est indexé sauf la liste noire</p>

    <div class="ds-admin__row fr-mt-2w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="new-pattern">Motif</label>
        <input
          id="new-pattern"
          v-model="pattern"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="ex : confidentiel ou */tmp"
        />
      </div>
      <DsfrButton size="sm" secondary label="Exclure" @click="add('exclude')" />
      <DsfrButton size="sm" secondary label="Inclure (liste blanche)" @click="add('include')" />
    </div>

    <hr class="fr-mt-3w fr-mb-2w" />

    <p class="fr-hint-text fr-mb-1v">Purger l'index existant selon un motif</p>
    <div class="ds-admin__row">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="purge-pattern">Motif à purger</label>
        <input
          id="purge-pattern"
          v-model="purgePattern"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="motif à purger"
        />
      </div>
      <DsfrButton size="sm" secondary label="Aperçu" @click="runPreview" />
    </div>

    <DsfrAlert v-if="purgeError" type="error" small :description="purgeError" class="fr-mt-1w" />

    <div v-if="preview" class="ds-admin__row fr-mt-1w">
      <p class="fr-hint-text fr-mb-0">
        {{ preview.matched }} document(s) correspondent à « {{ preview.pattern }} » (source
        « {{ selected }} »).
      </p>
      <DsfrButton
        v-if="preview.matched > 0"
        size="sm"
        label="Confirmer la suppression"
        @click="confirmPurge"
      />
    </div>

    <p v-if="purgeDone !== null" class="fr-hint-text fr-mt-1w">
      {{ purgeDone }} document(s) supprimé(s) de l'index.
    </p>
  </AdminPanel>
</template>
