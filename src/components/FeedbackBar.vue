<script setup lang="ts">
/**
 * Pouce haut/bas sous les résultats. Portage de renderFeedbackBar() /
 * submitFeedback() (docsearch-ui/public/js/feedback.js).
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { submitFeedback } from '@/api/engagement'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

/** Durée d'affichage du remerciement avant effacement de la barre. */
const DELAI_MERCI_MS = 3000

/** Avis enregistré : interdit d'en émettre un second sur la même recherche. */
const sent = ref(false)
/** Remerciement encore à l'écran — retombe à `false` tout seul. */
const merci = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
let minuteur: ReturnType<typeof setTimeout> | undefined

// La barre s'efface avec le remerciement : une fois l'avis donné, il n'y
// a plus rien à proposer sur cette recherche. Remettre la question et ses
// boutons inviterait au contraire à voter une deuxième fois.
const visible = computed(
  () => uiConfig.engagement.feedback_enabled && !!store.searchId && (!sent.value || merci.value),
)

function annuleMinuteur() {
  clearTimeout(minuteur)
  minuteur = undefined
}

// Une nouvelle recherche redonne droit à un avis.
watch(
  () => store.searchId,
  () => {
    annuleMinuteur()
    sent.value = false
    merci.value = false
    error.value = null
  },
)

onUnmounted(annuleMinuteur)

async function send(rating: 'up' | 'down') {
  // Fige l'identifiant : une recherche lancée entre-temps ne doit pas
  // déplacer la cible de l'avis.
  const searchId = store.searchId
  if (!searchId) return
  busy.value = true
  error.value = null
  try {
    await submitFeedback(searchId, rating)
    sent.value = true
    merci.value = true
    minuteur = setTimeout(() => {
      merci.value = false
      minuteur = undefined
    }, DELAI_MERCI_MS)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="visible" id="avis" class="ds-feedback fr-mt-2w">
    <template v-if="merci">
      <!-- role="status" : le message ne reste plus à l'écran, un lecteur
           d'écran doit donc l'annoncer au moment où il apparaît, faute de
           quoi il n'existe pas pour lui. -->
      <p id="avis-merci" class="fr-mb-0" role="status">Merci pour votre retour&nbsp;!</p>
    </template>
    <template v-else>
      <p class="fr-mb-0">Cette recherche vous a-t-elle été utile&nbsp;?</p>
      <!-- Icônes DSFR plutôt que les émojis 👍/👎 d'origine : ceux-ci
           changent de dessin selon le système, ignorent les jetons de
           couleur — donc le thème sombre et l'état désactivé — et
           servaient de NOM ACCESSIBLE au bouton, qu'un lecteur d'écran
           annonçait « pouce vers le haut » plutôt que l'action.
           thumb-up-line et thumb-down-line appartiennent à icons-system,
           déjà importée : aucun poids supplémentaire.
           Le libellé visible dit l'intention sans survol ; le nom
           accessible est une phrase entière, « Oui » ne voulant rien dire
           hors du contexte de la question. -->
      <button
        id="avis-utile"
        class="fr-btn fr-btn--sm fr-btn--secondary fr-btn--icon-left fr-icon-thumb-up-line"
        type="button"
        :disabled="busy"
        @click="send('up')"
      >
        Utile
        <span class="fr-sr-only">— cette recherche m'a été utile</span>
      </button>
      <button
        id="avis-peu-utile"
        class="fr-btn fr-btn--sm fr-btn--secondary fr-btn--icon-left fr-icon-thumb-down-line"
        type="button"
        :disabled="busy"
        @click="send('down')"
      >
        Peu utile
        <span class="fr-sr-only">— cette recherche ne m'a pas été utile</span>
      </button>
    </template>
    <DsfrAlert
      v-if="error"
      id="avis-erreur"
      type="error"
      small
      :description="`Impossible d'enregistrer votre avis : ${error}`"
    />
  </div>
</template>
