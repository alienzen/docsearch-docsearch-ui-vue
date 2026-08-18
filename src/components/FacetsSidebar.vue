<script setup lang="ts">
/**
 * Colonne de facettes. Portage de renderFacets()/renderCustomFacets()
 * de docsearch-ui/public/js/facets.js.
 *
 * Les 5 facettes fixes ont des sections figées ; les facettes SQL
 * personnalisées, elles, dépendent des sources en jeu — leur simple
 * `v-for` sur `facets.custom` remplace la reconstruction complète du
 * conteneur à chaque recherche : une facette dont le champ disparaît de
 * la réponse disparaît de l'écran, sans code de retrait dédié.
 */
import { computed } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { usePreferencesStore } from '@/stores/preferences'
import { extLabel } from '@/utils/format'
import { folderBasename } from '@/utils/paths'
import {
  dimensionsAffichables,
  periodeAffichable,
  seauxAffichables,
  type DimensionFacette,
} from '@/utils/facettes'
import type { FacetBucket } from '@/api/types'

const store = useSearchStore()
const uiConfig = useUiConfigStore()
const preferences = usePreferencesStore()

const facets = computed(() => store.facets)

/** Dimensions qu'apportent les sources sélectionnées — voir utils/facettes.ts. */
const dimensions = computed(() => dimensionsAffichables(store.source, uiConfig.allSources))

/**
 * Une facette fixe reste à l'écran si les sources sélectionnées portent
 * sa dimension, OU si la recherche lui a quand même trouvé des valeurs.
 *
 * Le second terme n'est pas une précaution de style : ce qu'une source
 * DÉCLARE et ce que ses documents PORTENT peuvent diverger (index plus
 * ancien que la configuration, colonne renommée), et une facette qui a
 * des valeurs ne doit jamais disparaître — c'est le seul endroit d'où on
 * peut les cocher.
 */
function affiche(dimension: DimensionFacette, buckets: FacetBucket[] = []) {
  return dimensions.value.has(dimension) || seauxAffichables(buckets).length > 0
}

/**
 * La période ne se décide pas comme les quatre autres facettes fixes :
 * elle n'a pas de seaux, c'est le compte `with_date` de la réponse qui en
 * tient lieu. Voir periodeAffichable().
 */
const affichePeriode = computed(() =>
  periodeAffichable(
    dimensions.value,
    facets.value?.with_date,
    Boolean(store.dateFrom || store.dateTo),
  ),
)

// Les dates passent par des champs locaux : on ne relance la recherche
// qu'à la validation, pas à chaque frappe dans le sélecteur de date.
const dateFrom = computed({
  get: () => store.dateFrom ?? '',
  set: (v: string) => (store.dateFrom = v || null),
})
const dateTo = computed({
  get: () => store.dateTo ?? '',
  set: (v: string) => (store.dateTo = v || null),
})
</script>

<template>
  <div class="ds-facets">
    <div id="facettes-entete" class="ds-facets__head">
      <h2 class="fr-h6 fr-mb-0">Affiner</h2>
      <!-- N'apparaît qu'avec des sections à replier : sans facettes, le
           bouton n'aurait aucun effet observable. -->
      <button
        v-if="preferences.presentFacets.length"
        id="facettes-tout-replier"
        class="fr-btn fr-btn--sm fr-btn--tertiary-no-outline"
        type="button"
        :title="`${preferences.allFacetsCollapsed ? 'Tout déplier' : 'Tout replier'} (t)`"
        aria-keyshortcuts="t"
        :aria-expanded="!preferences.allFacetsCollapsed"
        @click="preferences.toggleAllFacets()"
      >
        {{ preferences.allFacetsCollapsed ? 'Tout déplier' : 'Tout replier' }}
      </button>
    </div>

    <p v-if="!facets" class="fr-hint-text">Lancez une recherche pour affiner les résultats.</p>

    <template v-else>
      <!-- Les facettes fixes décrivent des documents de fichiers : elles
           ne s'affichent que si les sources sélectionnées les portent
           (voir `affiche`). Sans sélection de source, elles sont toutes
           là, comme avant. -->
      <FacetGroup
        v-if="affiche('ext', facets.extensions)"
        id="facet-extensions"
        title="Type de fichier"
        :buckets="facets.extensions"
        :selected="store.ext"
        :label-of="extLabel"
        empty-label="Aucun type"
        @toggle="store.toggleFacet('ext', $event)"
      />
      <FacetGroup
        id="facet-sources"
        title="Source"
        :buckets="facets.sources"
        :selected="store.source"
        :label-of="uiConfig.sourceLabel"
        empty-label="Aucune source"
        @toggle="store.toggleFacet('source', $event)"
      />
      <FacetGroup
        v-if="affiche('author', facets.authors)"
        id="facet-authors"
        title="Auteur"
        :buckets="facets.authors"
        :selected="store.author"
        empty-label="Aucun auteur"
        @toggle="store.toggleFacet('author', $event)"
      />
      <FacetGroup
        v-if="affiche('keywords', facets.keywords)"
        id="facet-keywords"
        title="Mots-clés"
        :buckets="facets.keywords"
        :selected="store.keywords"
        hint="Plusieurs mots-clés : seuls les documents portant tous les mots-clés cochés."
        empty-label="Aucun mot-clé"
        @toggle="store.toggleFacet('keywords', $event)"
      />
      <FacetGroup
        v-if="affiche('folder', facets.folders)"
        id="facet-folders"
        title="Dossier"
        :buckets="facets.folders"
        :selected="store.folder"
        :label-of="folderBasename"
        empty-label="Aucun dossier"
        @toggle="store.toggleFacet('folder', $event)"
      />

      <!-- Facettes propres aux sources SQL en jeu (ex: « Bureau »). -->
      <FacetGroup
        v-for="(facet, field) in facets.custom"
        :id="`facet-custom-${field}`"
        :key="field"
        :title="facet.label || field"
        :buckets="facet.buckets"
        :selected="store.custom[field] || []"
        empty-label="Aucune valeur"
        @toggle="store.toggleCustomFacet(field, $event)"
      />
      <!-- Même coquille que les facettes ci-dessus : repliable, persistée
           et comptée dans « tout replier ». Seul son corps diffère — deux
           dates plutôt qu'une liste de valeurs. Elle est passée DANS le
           `v-else` : hors de lui, elle s'affichait alors que les autres
           étaient absentes, ce qui la faisait paraître d'une autre
           nature. -->
      <FacetSection v-if="affichePeriode" id="facet-dates" title="Période de modification">
        <div class="fr-input-group fr-input-group--sm">
          <label class="fr-label" for="date-from">Du</label>
          <input id="date-from" v-model="dateFrom" class="fr-input" type="date" />
        </div>
        <div class="fr-input-group fr-input-group--sm">
          <label class="fr-label" for="date-to">Au</label>
          <input id="date-to" v-model="dateTo" class="fr-input" type="date" />
        </div>
        <DsfrButton
          id="facet-dates-appliquer"
          size="sm"
          label="Appliquer la période"
          @click="store.applyDateRange(dateFrom, dateTo)"
        />
      </FacetSection>
    </template>
  </div>
</template>
