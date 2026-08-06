<script setup lang="ts">
/**
 * Champ de mot de passe avec bascule « Afficher » — composant `fr-password`
 * du DSFR. Porté à l'identique de `charlie/app-front/src/components/
 * PasswordInput.vue`, pour que les deux applications se ressemblent là où
 * l'utilisateur les compare le plus : l'écran de connexion.
 *
 * La bascule est une **case à cocher « Afficher »**, pas une icône d'œil :
 * c'est la seule forme que le DSFR fournit.
 *
 * Le CSS vient du DSFR, mais PAS le comportement : `dsfr.module.js` n'est
 * pas chargé (voir src/dsfr.ts, qui n'importe que les feuilles de style).
 * La classe `PasswordToggle` du DSFR ne s'instancie donc jamais, et la
 * bascule est câblée ici en Vue — `:type` dynamique avec v-model, que
 * Vue 3 gère par `vModelDynamic`.
 *
 * `DsfrInput` rend un fragment `<label>` + `<div.fr-input-wrap>` sans
 * élément englobant : ses deux nœuds sont donc enfants DIRECTS de
 * `.fr-password`, ce qu'exige la mise en page du DSFR
 * (`.fr-password > .fr-label`).
 */
import { computed, ref, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

defineProps<{
  id: string
  label: string
  hint?: string
}>()

const model = defineModel<string>({ default: '' })
const revele = ref(false)

const attrs = useAttrs()
/**
 * Répartition des attributs de l'appelant : la `class` (fr-mb-3w…) décrit
 * l'espacement du champ dans le formulaire, elle va donc sur la racine
 * `.fr-password` ; tout le reste (name, autocomplete, required, disabled)
 * concerne la saisie et descend sur l'input.
 */
const attrsInput = computed(() => {
  const { class: _espacement, ...reste } = attrs
  return reste
})
</script>

<template>
  <div class="fr-password" :class="$attrs.class">
    <DsfrInput
      :id="id"
      v-model="model"
      v-bind="attrsInput"
      :type="revele ? 'text' : 'password'"
      :label="label"
      label-visible
      :hint="hint"
      is-with-wrapper
      class="fr-password__input"
    />
    <div class="fr-password__checkbox fr-checkbox-group fr-checkbox-group--sm">
      <input
        :id="`${id}-afficher`"
        v-model="revele"
        type="checkbox"
        aria-label="Afficher le mot de passe"
      />
      <label class="fr-password__checkbox fr-label" :for="`${id}-afficher`">Afficher</label>
    </div>
  </div>
</template>
