<script setup lang="ts">
/**
 * Boîte à idées. Portage de openSuggestionModal()/submitSuggestion()
 * (docsearch-ui/public/js/feedback.js).
 *
 * Anonyme PAR DÉFAUT : la case doit être cochée pour associer son
 * identité, jamais l'inverse.
 */
import { ref } from 'vue'
import { submitSuggestion, type SuggestionCategory } from '@/api/engagement'

defineProps<{ opened: boolean }>()
const emit = defineEmits<{ close: [] }>()

const text = ref('')
const category = ref<SuggestionCategory>('idea')
const notAnonymous = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const thanks = ref(false)

const categories = [
  { value: 'idea', text: 'Idée / amélioration' },
  { value: 'bug', text: 'Bug' },
  { value: 'other', text: 'Autre' },
]

async function send() {
  if (!text.value.trim()) {
    error.value = 'Le champ ne peut pas être vide.'
    return
  }
  busy.value = true
  error.value = null
  try {
    await submitSuggestion(text.value.trim(), category.value, !notAnonymous.value)
    thanks.value = true
    setTimeout(() => {
      thanks.value = false
      text.value = ''
      notAnonymous.value = false
      emit('close')
    }, 1500)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsfrModal
    modal-id="modale-suggestion"
    :opened="opened"
    title="Suggérer une idée"
    @close="emit('close')"
  >
    <p v-if="thanks" class="fr-mb-0">Merci pour votre suggestion !</p>
    <template v-else>
      <p>
        Une amélioration à proposer, un bug à signaler&nbsp;? Dites-nous tout — votre
        suggestion est envoyée de façon anonyme par défaut.
      </p>

      <DsfrSelect
        v-model="category"
        label="Catégorie"
        label-visible
        :options="categories"
      />

      <div class="fr-input-group fr-mt-2w">
        <label class="fr-label" for="suggestion-text">Votre suggestion</label>
        <textarea
          id="suggestion-text"
          v-model="text"
          class="fr-input"
          rows="5"
          placeholder="Votre suggestion…"
        />
      </div>

      <div class="fr-checkbox-group fr-mt-2w">
        <input id="suggestion-not-anonymous" v-model="notAnonymous" type="checkbox" />
        <label class="fr-label" for="suggestion-not-anonymous">
          Ne pas rester anonyme (associer mon identité à cette suggestion)
        </label>
      </div>

      <DsfrAlert v-if="error" type="error" small :description="error" class="fr-mt-2w" />
      <DsfrButton class="fr-mt-2w" label="Envoyer" :disabled="busy" @click="send" />
    </template>
  </DsfrModal>
</template>
