<script setup lang="ts">
// Page d'aide autonome — portage de docsearch-ui/public/help.html.
//
// Le contenu vit dans SearchHelp.vue, partagé avec le panneau d'aide de
// la page de recherche : docsearch-ui le dupliquait entre help.html et
// la modale de init.js, et les deux copies avaient déjà divergé.
//
// Elle s'ouvre dans un nouvel onglet depuis la recherche, ce qui la met
// côte à côte avec les résultats : son en-tête doit donc porter la même
// marque que celui d'à côté — titre, sous-titre et bloc-marque
// personnalisés compris — sinon les deux onglets semblent appartenir à
// deux applications différentes. D'où le chargement de la configuration,
// dont c'est ici le seul usage.
import { onMounted } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'

const uiConfig = useUiConfigStore()
onMounted(() => uiConfig.loadUiConfig())
</script>

<template>
  <DsfrHeader
    :service-title="uiConfig.headerTitle"
    :service-description="uiConfig.headerSubtitle"
    :logo-text="uiConfig.logoText"
    home-to="/"
  />

  <main id="main-content" class="fr-container ds-prose fr-my-4w">
    <h1 class="fr-h3">Aide</h1>
    <SearchHelp />
  </main>
</template>
