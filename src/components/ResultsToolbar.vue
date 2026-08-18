<script setup lang="ts">
/**
 * Barre au-dessus des résultats : compteur, tri, vue compacte, export.
 * Portage des éléments #result-count / #results-actions de index.html et
 * de toggleCompactView() (results.js).
 */
import { computed, ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiConfigStore } from '@/stores/uiConfig'
import { SORT_OPTIONS, TOTAL_HITS_CAP } from '@/constants'
import { fmtDuration } from '@/utils/format'
import { copyText } from '@/utils/paths'
import { lienPermanent } from '@/utils/permalien'
import type { ExportFormat } from '@/api/types'

const store = useSearchStore()
const preferences = usePreferencesStore()
const uiConfig = useUiConfigStore()

/**
 * Le moteur a cessé de compter : la recherche est trop large pour que
 * le total affiché ait un sens.
 */
const capped = computed(() => store.total >= TOTAL_HITS_CAP)

const countLabel = computed(() => {
  const total = store.total.toLocaleString('fr-FR')
  const plural = store.total > 1 ? 's' : ''
  const forQuery = store.query ? ` pour « ${store.query} »` : ''
  // « Plus de » et non le nombre nu : afficher « 10 000 résultats » pour
  // un décompte interrompu à 10 000 serait faux, le corpus pouvant en
  // contenir dix fois plus.
  const count = capped.value ? `Plus de ${total} résultats` : `${total} résultat${plural}`
  return `${count}${forQuery}`
})

// Même information qu'en bas de liste, répétée ici pour rester visible
// sans avoir à faire défiler jusqu'à la pagination.
const pageLabel = computed(() =>
  store.totalPages > 1 ? `Page ${store.page} sur ${store.totalPages}` : '',
)

/**
 * Le temps ne s'affiche que si l'administration l'a autorisé ET que
 * l'utilisateur ne l'a pas masqué. Le bouton, lui, ne dépend que de
 * l'autorisation : c'est ce qui permet de le rallumer après l'avoir
 * masqué.
 */
const timeAvailable = computed(
  () => uiConfig.config.search_time_enabled && store.timing !== null,
)
const showTime = computed(() => timeAvailable.value && preferences.showSearchTime)

const timeLabel = computed(() =>
  store.timing ? `en ${fmtDuration(store.timing.duration_ms)}` : '',
)

/**
 * Détail au survol : sans lui, une durée nue laisse croire que tout le
 * temps est passé dans le moteur, alors que l'écart entre les deux
 * mesures est justement ce qui oriente un diagnostic.
 */
const timeDetail = computed(() => {
  if (!store.timing) return ''
  const moteur = fmtDuration(store.timing.took_ms)
  return `Moteur de recherche : ${moteur} · traitement complet : ${fmtDuration(
    store.timing.duration_ms,
  )}. Temps de transmission réseau non compté.`
})

/**
 * Copie le permalien de la recherche affichée. On repasse par
 * `lienPermanent()` plutôt que de lire `window.location.href` : les deux
 * disent la même chose, mais le premier reste juste même si l'URL n'a pas
 * encore été réécrite, et il ne recopie pas d'éventuels paramètres
 * étrangers à la recherche.
 */
const lienCopie = ref(false)

async function copierLien() {
  await copyText(lienPermanent(store.criteresPermalien()))
  lienCopie.value = true
  setTimeout(() => (lienCopie.value = false), 1200)
}

const exportError = ref<string | null>(null)

async function exportAs(format: ExportFormat) {
  exportError.value = null
  try {
    await store.exportResults(format)
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div v-if="store.hasSearched" id="resultats-outils" class="ds-toolbar fr-mb-2w">
    <p id="resultats-decompte" class="fr-mb-0">
      <strong>{{ countLabel }}</strong>
      <span v-if="pageLabel" class="fr-hint-text fr-ml-1w">{{ pageLabel }}</span>
      <span
        v-if="showTime"
        id="resultats-duree"
        class="fr-hint-text fr-ml-1w"
        :title="timeDetail"
        >{{ timeLabel }}</span
      >
      <!-- Réaffinage sur des résultats déjà affichés : le seul signe
           d'attente, la liste restant en place. `aria-hidden` car
           l'annonce vocale est déjà portée par ResultsList — la répéter
           ici la ferait entendre deux fois. -->
      <span v-if="store.loading" class="ds-spinner ds-spinner--sm fr-ml-1w" aria-hidden="true" />
    </p>

    <div class="ds-toolbar__actions">
      <!-- Cette bascule vit ICI et non dans la colonne de facettes :
           placée dedans, elle disparaîtrait avec elle et il n'y aurait
           plus aucun moyen de la rouvrir. `aria-expanded` porte l'état,
           ce qui évite un libellé changeant à chaque clic. -->
      <button
        id="filtres-bascule"
        class="fr-btn fr-btn--sm fr-btn--secondary fr-btn--icon-left fr-icon-filter-line"
        type="button"
        aria-controls="facets"
        title="Afficher ou masquer les filtres (f)"
        aria-keyshortcuts="f"
        :aria-expanded="!preferences.facetsHidden"
        @click="preferences.facetsHidden = !preferences.facetsHidden"
      >
        Filtres
      </button>

      <!-- Rien à densifier quand la liste est vide. -->
      <DsfrButton
        v-if="store.total > 0"
        id="resultats-vue-compacte"
        size="sm"
        secondary
        :label="preferences.resultsCompact ? 'Vue détaillée' : 'Vue compacte'"
        title="Basculer la vue compacte (c)"
        aria-keyshortcuts="c"
        @click="preferences.resultsCompact = !preferences.resultsCompact"
      />

      <!-- Conditionné à la disponibilité d'une mesure et non au seul
           flag : un bouton « Afficher le temps » qui n'afficherait rien
           parce que l'API n'en renvoie pas encore serait pire que pas de
           bouton du tout. -->
      <DsfrButton
        v-if="timeAvailable"
        id="resultats-duree-bascule"
        size="sm"
        secondary
        :label="preferences.showSearchTime ? 'Masquer le temps' : 'Afficher le temps'"
        @click="preferences.showSearchTime = !preferences.showSearchTime"
      />

      <!-- Le lien porte la recherche, jamais les droits : le destinataire
           la rejoue avec SES ACL et peut en voir moins. Dit dans
           l'infobulle plutôt que nulle part — c'est la question que pose
           tout le monde la première fois qu'on partage un lien. -->
      <DsfrButton
        id="resultats-copier-lien"
        size="sm"
        secondary
        :label="lienCopie ? 'Lien copié' : 'Copier le lien'"
        title="Copier le lien de cette recherche. Le lien partage la recherche, pas les droits d'accès : chacun la rejoue avec les siens."
        @click="copierLien"
      />

      <template v-if="uiConfig.config.export_enabled">
        <DsfrButton
          id="resultats-export-xlsx"
          size="sm"
          secondary
          label="Export XLSX"
          @click="exportAs('xlsx')"
        />
        <DsfrButton
          id="resultats-export-docx"
          size="sm"
          secondary
          label="Export DOCX"
          @click="exportAs('docx')"
        />
      </template>

      <!-- En dernier, donc tout à droite de la barre : le tri est le seul
           contrôle qui porte sur l'ordre de la liste, les autres sur son
           affichage ou son export. Le groupe reste plus haut que les
           boutons, son libellé occupant une ligne au-dessus ; placé en
           bout de rangée, il ne la coupe plus en deux. -->
      <div v-if="uiConfig.config.sort_enabled" class="fr-select-group fr-mb-0">
        <label class="fr-label" for="resultats-tri">Trier par</label>
        <!-- Balisage DSFR direct plutôt que DsfrSelect : ce composant
             ajoute toujours en tête une option « Sélectionner une
             option » vide et désactivée, destinée aux formulaires où
             rien n'est encore choisi. Le tri, lui, a toujours une
             valeur — au minimum la pertinence — et cette entrée grisée
             n'y désigne rien. Aucune prop ne la retire. -->
        <select
          id="resultats-tri"
          class="fr-select fr-select--sm"
          :value="store.sort"
          @change="store.setSort(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
            {{ option.text }}
          </option>
        </select>
      </div>
    </div>

    <!-- Avertissement plutôt qu'information : le tri par pertinence
         perd de son intérêt sur un ensemble aussi large, et l'export ne
         portera que sur les documents effectivement rapatriés. -->
    <DsfrAlert
      v-if="capped"
      id="resultats-trop-nombreux"
      type="warning"
      small
      description="Votre recherche renvoie trop de résultats pour être comptée précisément. Affinez-la avec les filtres ou des mots-clés supplémentaires pour obtenir un décompte exact et des résultats plus pertinents."
      class="fr-mt-1w"
    />

    <DsfrAlert
      v-if="exportError"
      id="resultats-erreur-export"
      type="error"
      small
      :description="`Impossible d'exporter les résultats : ${exportError}`"
      class="fr-mt-1w"
    />
  </div>
</template>
