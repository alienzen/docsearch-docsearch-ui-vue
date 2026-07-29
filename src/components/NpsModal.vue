<script setup lang="ts">
/**
 * Popup NPS occasionnelle. Portage de showNpsModal()/submitNps()
 * (docsearch-ui/public/js/feedback.js) — la logique de déclenchement
 * vit dans useNps().
 */
import { ref } from 'vue'
import { submitNps } from '@/api/engagement'

defineProps<{ opened: boolean }>()
const emit = defineEmits<{ close: [] }>()

const thanks = ref(false)
const scores = Array.from({ length: 11 }, (_, i) => i)

async function send(score: number) {
  try {
    await submitNps(score)
  } catch {
    // Échec silencieux : ne pas transformer un remerciement en erreur
    // visible pour quelqu'un qui vient de rendre service.
  }
  thanks.value = true
  setTimeout(() => {
    thanks.value = false
    emit('close')
  }, 1500)
}
</script>

<template>
  <DsfrModal :opened="opened" title="Une question rapide" @close="emit('close')">
    <p v-if="thanks" class="fr-mb-0">Merci pour votre retour !</p>
    <template v-else>
      <p>Sur une échelle de 0 à 10, recommanderiez-vous DocSearch à un collègue&nbsp;?</p>
      <ul class="ds-nps__scale">
        <li v-for="score in scores" :key="score">
          <button class="fr-btn fr-btn--secondary fr-btn--sm" @click="send(score)">
            {{ score }}
          </button>
        </li>
      </ul>
      <p class="ds-nps__labels fr-hint-text">
        <span>Pas du tout probable</span>
        <span>Très probable</span>
      </p>
    </template>
  </DsfrModal>
</template>
