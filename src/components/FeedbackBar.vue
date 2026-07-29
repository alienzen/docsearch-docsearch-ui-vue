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
      <DsfrButton size="sm" secondary label="👍" title="Oui" :disabled="busy" @click="send('up')" />
      <DsfrButton size="sm" secondary label="👎" title="Non" :disabled="busy" @click="send('down')" />
    </template>
    <DsfrAlert v-if="error" type="error" small :description="`Impossible d'enregistrer votre avis : ${error}`" />
  </div>
</template>
