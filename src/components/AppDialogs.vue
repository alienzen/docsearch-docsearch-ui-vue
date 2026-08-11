<script setup lang="ts">
/**
 * Hôte des confirmations et saisies (voir le store `dialogs`). À monter
 * UNE fois par page qui en utilise — actuellement la recherche et
 * l'administration.
 *
 * Téléporté dans <body> : les appelants sont souvent des panneaux de
 * l'en-tête, et à l'intérieur d'un `.fr-collapse` replié une modale
 * hérite du `visibility: hidden` que lui applique le DSFR.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useDialogsStore } from '@/stores/dialogs'

const dialogs = useDialogsStore()

const value = ref('')
const error = ref<string | null>(null)
const field = ref<HTMLInputElement | null>(null)

const pending = computed(() => dialogs.pending)

watch(pending, async (request) => {
  if (request?.kind !== 'prompt') return
  value.value = request.initial
  error.value = null
  // Le curseur doit partir dans le champ, comme le faisait `prompt()`.
  // `nextTick` ne suffit pas : DsfrModal installe son piège de focus
  // APRÈS le rendu et pose le focus sur son bouton de fermeture. Il faut
  // donc repasser après lui, d'où la macro-tâche.
  await nextTick()
  setTimeout(() => {
    field.value?.focus()
    field.value?.select()
  }, 0)
})

function submit() {
  const request = pending.value
  if (request?.kind !== 'prompt') return
  const trimmed = value.value.trim()
  // La validation vit ici et non chez l'appelant : contrairement à
  // `prompt()`, on peut redemander sans avoir tout perdu.
  const message = request.validate?.(trimmed) ?? null
  if (message) {
    error.value = message
    return
  }
  dialogs.settle(trimmed)
}
</script>

<template>
  <Teleport to="body">
    <DsfrModal
      v-if="pending?.kind === 'confirm'"
      modal-id="modale-confirmation"
      opened
      :title="pending.title"
      :is-alert="pending.danger"
      size="sm"
      :actions="[
        { label: pending.confirmLabel, onClick: () => dialogs.settle(true) },
        { label: 'Annuler', secondary: true, onClick: () => dialogs.settle(false) },
      ]"
      @close="dialogs.dismiss()"
    >
      <p class="fr-mb-0">{{ pending.message }}</p>
    </DsfrModal>

    <DsfrModal
      v-else-if="pending?.kind === 'prompt'"
      modal-id="modale-saisie"
      opened
      :title="pending.title"
      size="sm"
      :actions="[
        { label: 'Valider', onClick: submit },
        { label: 'Annuler', secondary: true, onClick: () => dialogs.settle(null) },
      ]"
      @close="dialogs.dismiss()"
    >
      <div class="fr-input-group" :class="{ 'fr-input-group--error': error }">
        <label class="fr-label" for="ds-dialog-input">{{ pending.message }}</label>
        <input
          id="ds-dialog-input"
          ref="field"
          v-model="value"
          class="fr-input"
          type="text"
          :aria-describedby="error ? 'ds-dialog-error' : undefined"
          @keydown.enter.prevent="submit"
        />
        <p v-if="error" id="ds-dialog-error" class="fr-error-text">{{ error }}</p>
      </div>
    </DsfrModal>
  </Teleport>
</template>
