<script setup lang="ts">
/**
 * Bouton « Haut de page » flottant, apparaissant une fois la page
 * défilée — comportement de docsearch-ui.
 *
 * Le composant DsfrBackToTop du DSFR rend bien le lien attendu (libellé,
 * icône, style), mais le pose EN FIN DE PAGE : il faut donc déjà avoir
 * tout parcouru pour l'atteindre. On garde son balisage, dans un
 * conteneur fixe qui le rend accessible à tout moment.
 */
import { useScrolled } from '@/composables/useScrolled'

const { scrolled } = useScrolled()
</script>

<template>
  <!-- `v-show` et non `v-if` : l'élément reste dans le DOM, ce qui évite
       de le recréer à chaque franchissement du seuil pendant le
       défilement. -->
  <div v-show="scrolled" class="ds-back-to-top">
    <DsfrBackToTop label="Haut de page" />
  </div>
</template>
