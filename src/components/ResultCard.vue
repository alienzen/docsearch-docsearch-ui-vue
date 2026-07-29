<script setup lang="ts">
/**
 * Une carte de résultat. Portage de renderCard() de
 * docsearch-ui/public/js/results.js.
 *
 * Deux changements de fond par rapport au HTML assemblé à la main :
 *  - le titre et l'extrait ne sont plus injectés en HTML brut (voir
 *    parseHighlight) : seul le surlignage <em> d'Elasticsearch est
 *    conservé, le reste est rendu comme du texte, donc échappé ;
 *  - la pastille de couleur par extension/source (EXT_COLORS,
 *    SOURCE_PALETTE) laisse place aux badges DSFR : des couleurs
 *    maison n'auraient pas tenu le contraste en thème sombre.
 */
import { computed, ref } from 'vue'
import type { SearchResult } from '@/api/types'
import { extLabel, fmtSize } from '@/utils/format'
import { copyText, dirOfPath, displayPath } from '@/utils/paths'
import { parseHighlights } from '@/utils/highlight'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiConfigStore } from '@/stores/uiConfig'

const props = defineProps<{ result: SearchResult; selected: boolean }>()
const emit = defineEmits<{ 'update:selected': [boolean]; detail: [string] }>()

const preferences = usePreferencesStore()
const uiConfig = useUiConfigStore()

/**
 * Dépli individuel. La vue compacte ne fixe que l'état INITIAL : une
 * carte dépliée à la main le reste — mais basculer la vue d'ensemble
 * réimpose un état uniforme à toutes les cartes (voir ResultsList).
 */
const expanded = ref(!preferences.resultsCompact)

const title = computed(() => props.result.title || props.result.filename || '(sans nom)')
const snippets = computed(() => parseHighlights(props.result.highlight || []))
/** Score ES ramené en pourcentage, comme en vanilla. */
const scorePct = computed(() => Math.min(100, Math.round((props.result.score || 0) * 20)))
/** Un membre d'archive a un chemin de la forme "archive.zip::interne". */
const isArchiveMember = computed(() => (props.result.filepath || '').includes('::'))

/** Case à cocher pour les collections, si la source l'autorise. */
const selectable = computed(
  () =>
    uiConfig.config.collections_enabled && uiConfig.sourceCollectable(props.result.source || ''),
)

const copied = ref<'dir' | 'full' | null>(null)

async function copyPath(kind: 'dir' | 'full') {
  const full = displayPath(
    props.result.filepath || '',
    uiConfig.config.sources_mount,
    uiConfig.config.sources_mount_display,
  )
  await copyText(kind === 'dir' ? dirOfPath(full) : full)
  copied.value = kind
  setTimeout(() => (copied.value = null), 1200)
}
</script>

<template>
  <div class="fr-card fr-card--no-arrow ds-result">
    <div class="ds-result__header">
      <div v-if="selectable" class="fr-checkbox-group fr-checkbox-group--sm ds-result__select">
        <input
          :id="`select-${result.id}`"
          type="checkbox"
          :checked="selected"
          @change="emit('update:selected', ($event.target as HTMLInputElement).checked)"
        />
        <label class="fr-label" :for="`select-${result.id}`">
          <span class="fr-sr-only">Sélectionner ce document</span>
        </label>
      </div>

      <button
        class="ds-result__toggle"
        :aria-expanded="expanded"
        :aria-controls="`body-${result.id}`"
        @click="expanded = !expanded"
      >
        <span class="fr-badge fr-badge--sm">{{ extLabel(result.extension) }}</span>
        <span class="ds-result__title">{{ title }}</span>
        <span class="fr-badge fr-badge--sm fr-badge--info">{{ scorePct }} %</span>
      </button>
    </div>

    <div v-show="expanded" :id="`body-${result.id}`" class="ds-result__body">
      <ul class="ds-result__meta fr-text--sm">
        <li v-if="result.source">Source : {{ uiConfig.sourceLabel(result.source) }}</li>
        <li v-if="result.author">Auteur : {{ result.author }}</li>
        <li>Modifié : {{ result.date_modified ? result.date_modified.slice(0, 10) : '—' }}</li>
        <li v-if="result.folder">Dossier : {{ result.folder }}</li>
        <li>Taille : {{ fmtSize(result.size) }}</li>
        <li v-if="isArchiveMember">Extrait d'une archive</li>
      </ul>

      <p v-if="result.filepath" class="ds-result__path fr-text--sm">
        <span class="ds-result__path-text" :title="result.filepath">{{ result.filepath }}</span>
        <DsfrButton
          size="sm"
          tertiary
          no-outline
          :label="copied === 'dir' ? 'Copié' : 'Copier le dossier'"
          @click="copyPath('dir')"
        />
        <DsfrButton
          size="sm"
          tertiary
          no-outline
          :label="copied === 'full' ? 'Copié' : 'Copier le chemin'"
          @click="copyPath('full')"
        />
      </p>

      <p v-if="snippets.length" class="ds-result__snippet fr-text--sm">
        <template v-for="(segment, i) in snippets" :key="i">
          <mark v-if="segment.marked">{{ segment.text }}</mark>
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>

      <DsfrButton
        size="sm"
        tertiary
        label="Voir le détail complet (droits d'accès, aperçu…)"
        @click="emit('detail', result.id)"
      />
    </div>
  </div>
</template>
