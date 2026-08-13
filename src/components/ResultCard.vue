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
import { parseHighlights } from '@/utils/highlight'
import { sourceCardCustom } from '@/utils/sourceCards'
import { extraFields } from '@/utils/extraFields'
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

/**
 * Champs apportés par la source, au-delà du schéma commun. Les libellés
 * viennent de `card_fields` de la source (mapping SQL) ; à défaut ils
 * sont dérivés du nom de champ, et un libellé vide masque le champ.
 */
const extras = computed(() =>
  extraFields(props.result, uiConfig.sourceCardFields(props.result.source || '')),
)

/** Réglages propres à la source, s'il en existe (public/custom-sources.js). */
const custom = computed(() => sourceCardCustom(props.result.source))

const title = computed(
  () =>
    (custom.value?.titlePrefix || '') +
    (props.result.title || props.result.filename || '(sans nom)'),
)
const snippets = computed(() => parseHighlights(props.result.highlight || []))
/**
 * Score ES ramené en pourcentage, comme en vanilla — ou `null` quand il
 * n'y a pas de score du tout.
 *
 * Un document épinglé n'a pas été classé, il a été DÉSIGNÉ : l'API lui
 * met `score: null` (voir SearchResult). Le compter pour zéro affichait
 * « 0 % » sur un document mis en avant par l'administration, soit le
 * pire score possible sur la carte la plus en vue de la page.
 */
const scorePct = computed(() =>
  props.result.score == null ? null : Math.min(100, Math.round(props.result.score * 20)),
)
/** Un membre d'archive a un chemin de la forme "archive.zip::interne". */
const isArchiveMember = computed(() => (props.result.filepath || '').includes('::'))

/**
 * L'aperçu convertit un FICHIER : sans chemin, il n'y a rien à
 * convertir. Une ligne de source SQL n'en a pas — le lien menait à une
 * erreur. Un membre d'archive en a un, mais le fichier n'existe que le
 * temps de l'indexation, d'où la seconde condition.
 */
const previewable = computed(() => !!props.result.filepath && !isArchiveMember.value)

/** Case à cocher pour les collections, si la source l'autorise. */
const selectable = computed(
  () =>
    uiConfig.config.collections_enabled && uiConfig.sourceCollectable(props.result.source || ''),
)
</script>

<template>
  <!-- `data-source` est le point d'accroche des personnalisations par
       source (public/custom-sources.css) — l'équivalent de l'attribut de
       même nom sur `.result-card` dans docsearch-ui. -->
  <div
    class="fr-card fr-card--no-arrow ds-result"
    data-testid="carte-resultat"
    :data-id="result.id"
    :data-source="result.source || undefined"
    :style="custom?.accent ? { '--ds-result-accent': custom.accent } : undefined"
  >
    <div class="ds-result__header">
      <div v-if="selectable" class="fr-checkbox-group fr-checkbox-group--sm ds-result__select">
        <input
          :id="`select-${result.id}`"
          data-testid="carte-resultat-selection"
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
        data-testid="carte-resultat-titre"
        :aria-expanded="expanded"
        :aria-controls="`body-${result.id}`"
        @click="expanded = !expanded"
      >
        <span class="fr-badge fr-badge--sm">{{ extLabel(result.extension) }}</span>
        <span v-if="custom?.badge" class="fr-badge fr-badge--sm ds-result__custom-badge">
          {{ custom.badge }}
        </span>
        <span class="ds-result__title">{{ title }}</span>
        <span v-if="scorePct !== null" class="fr-badge fr-badge--sm fr-badge--info">
          {{ scorePct }} %
        </span>
      </button>
    </div>

    <div v-show="expanded" :id="`body-${result.id}`" class="ds-result__body">
      <ul class="ds-result__meta fr-text--sm">
        <li v-if="result.source">Source : {{ uiConfig.sourceLabel(result.source) }}</li>
        <li v-if="result.author">Auteur : {{ result.author }}</li>
        <!-- Date et taille sous condition : une ligne de source SQL n'a
             ni l'une ni l'autre, et affichait « Modifié : — / Taille : — »
             au milieu de ses vraies données. -->
        <li v-if="result.date_modified">Modifié : {{ result.date_modified.slice(0, 10) }}</li>
        <li v-if="result.folder">Dossier : {{ result.folder }}</li>
        <li v-if="result.size">Taille : {{ fmtSize(result.size) }}</li>
        <li v-if="isArchiveMember">Extrait d'une archive</li>

        <!-- Champs apportés par la source (colonnes d'une source SQL) :
             bureau, fonction, téléphone… Pour ce type de source, c'est
             l'essentiel de l'information — un agent sans son téléphone
             ni son bureau n'apprend rien. -->
        <li v-for="champ in extras" :key="champ.key">
          {{ champ.label }} : {{ champ.value }}
        </li>
      </ul>

      <p v-if="result.filepath" class="ds-result__path fr-text--sm">
        <span class="ds-result__path-text" :title="result.filepath">{{ result.filepath }}</span>
        <CopyPathButtons :filepath="result.filepath" />
      </p>

      <p v-if="snippets.length" class="ds-result__snippet fr-text--sm">
        <template v-for="(segment, i) in snippets" :key="i">
          <mark v-if="segment.marked">{{ segment.text }}</mark>
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>

      <div class="ds-result__actions">
        <DsfrButton
          size="sm"
          tertiary
          label="Voir le détail du document"
          data-testid="carte-resultat-detail"
          @click="emit('detail', result.id)"
        />
        <!-- Aperçu accessible sans ouvrir la fiche détail, qui ne servait
             qu'à atteindre ce lien dans bien des cas. -->
        <a
          v-if="previewable"
          class="fr-link fr-link--sm fr-icon-eye-line fr-link--icon-left"
          data-testid="carte-resultat-apercu"
          :href="`/api/preview/${result.id}`"
          target="_blank"
          rel="noopener"
          title="Voir l'aperçu — nouvelle fenêtre"
        >
          Voir l'aperçu
        </a>
      </div>
    </div>
  </div>
</template>
