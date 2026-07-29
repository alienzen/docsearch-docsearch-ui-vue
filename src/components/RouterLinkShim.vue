<script setup lang="ts">
/**
 * Remplaçant de `<RouterLink>` pour l'architecture multi-pages.
 *
 * Les composants de vue-dsfr rendent `RouterLink` dès qu'un lien est
 * interne (tout `to` qui ne commence pas par `http`) — c'est le cas de
 * DsfrHeader, DsfrNavigation, DsfrCard, DsfrSideMenu, DsfrFooter... Sans
 * routeur enregistré, Vue ne résout pas ce composant : le lien est rendu
 * comme un élément inconnu, silencieusement non cliquable.
 *
 * Installer un vrai vue-router résoudrait le rendu mais intercepterait
 * les clics côté client, alors qu'ici chaque page (/, /help, /chat,
 * /admin.html) est une entrée HTML distincte que Nginx doit servir
 * lui-même — c'est précisément ce qui lui permet d'appliquer son
 * contrôle d'accès par page (auth_request). On veut donc une navigation
 * pleine page : un simple <a href>.
 *
 * Si un jour une page interne a besoin de routes côté client (prévu pour
 * admin.html), elle installera son propre routeur, qui enregistrera le
 * vrai RouterLink et prendra le pas sur ce shim.
 */
import { computed } from 'vue'

const props = defineProps<{
  // Même signature que RouterLink, mais on ne gère que la forme chaîne :
  // vue-dsfr ne passe que des chaînes, et un objet de route n'aurait
  // aucun sens sans routeur.
  to?: string | Record<string, unknown>
}>()

const href = computed(() => (typeof props.to === 'string' ? props.to : undefined))
</script>

<template>
  <a :href="href"><slot /></a>
</template>
