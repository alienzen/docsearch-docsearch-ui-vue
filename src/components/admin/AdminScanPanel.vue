<script setup lang="ts">
/** Déclenchement d'un scan d'indexation sur une source fichier. */
import { ref, watch } from 'vue'
import { startScan } from '@/api/admin'

const props = defineProps<{ sources: string[] }>()

const selected = ref('documents')
const subfolder = ref('')
const busy = ref(false)
const result = ref<string | null>(null)
const error = ref<string | null>(null)

watch(
  () => props.sources,
  (list) => {
    if (list.length && !list.includes(selected.value)) selected.value = list[0]
  },
)

async function launch() {
  busy.value = true
  error.value = null
  result.value = null
  try {
    const res = await startScan(selected.value, subfolder.value.trim() || null)
    result.value = `Scan démarré (source « ${res.source} », ${res.subfolder}). Suivre la progression dans « État des composants ».`
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AdminPanel id="scan-panel" title="Indexation">
    <p class="fr-hint-text">
      Publie les fichiers d'UNE source sur Kafka pour indexation par les workers actifs (pool
      partagé entre toutes les sources) — ne bloque pas, suivre la progression dans « État des
      composants » ci-dessus.
    </p>

    <div class="ds-admin__row">
      <div class="fr-select-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="scan-source">Source</label>
        <select id="scan-source" v-model="selected" class="fr-select fr-select--sm">
          <option v-for="source in sources" :key="source" :value="source">{{ source }}</option>
        </select>
      </div>
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label fr-sr-only" for="scan-subfolder">Sous-dossier</label>
        <input
          id="scan-subfolder"
          v-model="subfolder"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="sous-dossier (vide = dossier complet)"
        />
      </div>
      <DsfrButton id="scan-lancer" size="sm" label="Lancer un scan" :disabled="busy" @click="launch" />
    </div>

    <DsfrAlert
      v-if="error"
      id="scan-erreur"
      type="error"
      small
      :description="error"
      class="fr-mt-1w"
    />
    <p v-if="result" id="scan-resultat" class="fr-hint-text fr-mt-1w">{{ result }}</p>
  </AdminPanel>
</template>
