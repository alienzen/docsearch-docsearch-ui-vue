<script setup lang="ts">
/** Arborescence d'une source fichier, chargée dossier par dossier. */
import { ref, watch } from 'vue'
import { getSourceTree, type TreeEntry } from '@/api/admin'

const props = defineProps<{ sources: string[] }>()

const selected = ref('documents')
const entries = ref<TreeEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function loadRoot() {
  loading.value = true
  error.value = null
  try {
    // `?? []` : une réponse inattendue (endpoint indisponible, source
    // supprimée entre-temps) ne doit pas faire planter le rendu du
    // panneau — il affiche « dossier vide » plutôt qu'un écran cassé.
    entries.value = (await getSourceTree(selected.value, '')).entries ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    entries.value = []
  } finally {
    loading.value = false
  }
}

watch(selected, loadRoot)
watch(
  () => props.sources,
  (list) => {
    if (!list.length) return
    if (!list.includes(selected.value)) selected.value = list[0]
    // Premier chargement : on attend de connaître les sources, sinon on
    // interrogerait « documents » alors qu'elle n'existe peut-être pas.
    if (!entries.value.length && !loading.value) loadRoot()
  },
  { immediate: true },
)
</script>

<template>
  <AdminPanel
    id="source-tree-panel"
    title="Arborescence des sources"
    subtitle="chargée à la demande, dossier par dossier"
  >
    <p class="fr-hint-text">
      Un dossier n'est chargé qu'au moment où vous le dépliez. Les éléments barrés sont exclus par
      les filtres de sous-dossiers ; ceux marqués « liste blanche » correspondent explicitement à un
      motif inclus.
    </p>

    <div class="fr-select-group ds-admin__source-select">
      <label class="fr-label" for="tree-source">Source</label>
      <select id="tree-source" v-model="selected" class="fr-select fr-select--sm">
        <option v-for="source in sources" :key="source" :value="source">{{ source }}</option>
      </select>
    </div>

    <p v-if="loading" class="fr-hint-text fr-mt-2w">Chargement…</p>
    <DsfrAlert v-else-if="error" type="error" small :description="error" class="fr-mt-2w" />
    <p v-else-if="!entries.length" class="fr-hint-text fr-mt-2w">(dossier vide)</p>
    <AdminTreeNode v-else class="fr-mt-2w" :source="selected" :entries="entries" />
  </AdminPanel>
</template>
