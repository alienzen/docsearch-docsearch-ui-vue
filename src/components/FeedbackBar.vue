<script setup lang="ts">
/**
 * Pouce haut/bas sous les résultats. Portage de renderFeedbackBar() /
 * submitFeedback() (docsearch-ui/public/js/feedback.js).
 */
import { computed, ref, watch } from 'vue'
import { submitFeedback } from '@/api/engagement'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const sent = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

const visible = computed(() => uiConfig.engagement.feedback_enabled && !!store.searchId)

// Une nouvelle recherche redonne droit à un avis.
watch(
  () => store.searchId,
  () => {
    sent.value = false
    error.value = null
  },
)

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
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="ds-feedback fr-mt-2w">
    <template v-if="sent">
      <p class="fr-mb-0">Merci pour votre retour !</p>
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
        class="fr-btn fr-btn--sm fr-btn--secondary fr-btn--icon-left fr-icon-thumb-up-line"
        type="button"
        :disabled="busy"
        @click="send('up')"
      >
        Utile
        <span class="fr-sr-only">— cette recherche m'a été utile</span>
      </button>
      <button
        class="fr-btn fr-btn--sm fr-btn--secondary fr-btn--icon-left fr-icon-thumb-down-line"
        type="button"
        :disabled="busy"
        @click="send('down')"
      >
        Peu utile
        <span class="fr-sr-only">— cette recherche ne m'a pas été utile</span>
      </button>
    </template>
    <DsfrAlert v-if="error" type="error" small :description="`Impossible d'enregistrer votre avis : ${error}`" />
  </div>
</template>
