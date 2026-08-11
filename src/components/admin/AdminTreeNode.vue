<script setup lang="ts">
/**
 * Un niveau de l'arborescence d'une source. Composant récursif : chaque
 * dossier déplié rend un AdminTreeNode pour son contenu.
 *
 * Le contenu d'un dossier n'est demandé qu'au premier dépliage, et
 * conservé ensuite — replier puis rouvrir ne relance pas de requête.
 */
import { ref } from 'vue'
import { getSourceTree, type TreeEntry } from '@/api/admin'

defineProps<{ source: string; entries: TreeEntry[] }>()

/** Contenu chargé, par chemin de dossier. */
const children = ref<Record<string, TreeEntry[]>>({})
const open = ref<Record<string, boolean>>({})
const loading = ref<Record<string, boolean>>({})
const errors = ref<Record<string, string>>({})

async function toggle(source: string, entry: TreeEntry) {
  if (entry.type !== 'dir') return
  open.value[entry.path] = !open.value[entry.path]
  if (!open.value[entry.path] || children.value[entry.path]) return

  loading.value[entry.path] = true
  delete errors.value[entry.path]
  try {
    // `?? []` : même précaution qu'au niveau racine, une réponse
    // inattendue affiche « dossier vide » au lieu de casser le rendu.
    children.value[entry.path] = (await getSourceTree(source, entry.path)).entries ?? []
  } catch (e) {
    errors.value[entry.path] = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value[entry.path] = false
  }
}
</script>

<template>
  <ul class="ds-tree">
    <li v-for="entry in entries" :key="entry.path">
      <!-- « exclu » prime visuellement sur « liste blanche », comme la
           règle métier : un chemin exclu le reste même s'il correspond
           aussi à un motif inclus. -->
      <!-- Aucun `id` ici : ce composant se rend RÉCURSIVEMENT, donc
           autant de fois qu'il y a de niveaux de dossiers. Le chemin,
           lui, est unique dans l'arbre — il va donc dans un `data-*`. -->
      <component
        :is="entry.type === 'dir' ? 'button' : 'span'"
        class="ds-tree__entry"
        data-testid="arbre-entree"
        :data-chemin="entry.path"
        :class="{
          'ds-tree__entry--excluded': entry.excluded,
          'ds-tree__entry--included': !entry.excluded && entry.included,
        }"
        :aria-expanded="entry.type === 'dir' ? !!open[entry.path] : undefined"
        @click="toggle(source, entry)"
      >
        <span v-if="entry.type === 'dir'" aria-hidden="true">
          {{ open[entry.path] ? '▾' : '▸' }}
        </span>
        <span>{{ entry.name }}{{ entry.type === 'dir' ? '/' : '' }}</span>
        <span v-if="entry.excluded" class="fr-hint-text">(exclu par les filtres)</span>
        <span v-else-if="entry.included" class="fr-hint-text">(liste blanche)</span>
      </component>

      <template v-if="entry.type === 'dir' && open[entry.path]">
        <p v-if="loading[entry.path]" class="fr-hint-text fr-mb-0">Chargement…</p>
        <DsfrAlert v-else-if="errors[entry.path]" type="error" small :description="errors[entry.path]" />
        <p v-else-if="!children[entry.path]?.length" class="fr-hint-text fr-mb-0">(dossier vide)</p>
        <AdminTreeNode v-else :source="source" :entries="children[entry.path]" />
      </template>
    </li>
  </ul>
</template>
