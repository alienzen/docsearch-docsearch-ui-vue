<script setup lang="ts">
// Coquille de la page de recherche : valide le socle (DSFR, scheme,
// liens multi-pages). Le contenu réel — barre de recherche, facettes,
// résultats — arrive avec le portage de la couche API et des stores.
import { ref } from 'vue'
import { useScheme } from '@gouvminint/vue-dsfr'

// Icônes en classes CSS `fr-icon-*` (convention DSFR) plutôt qu'en prop
// `icon:` — cette dernière passe par Iconify, dont le bundle coûte 1 Mo
// de JS pour un résultat visuellement identique (voir vite.config.ts).
const quickLinks = [
  { label: 'Aide', to: '/help', class: 'fr-link--icon-left fr-icon-question-line' },
  { label: 'Assistant IA', to: '/chat', class: 'fr-link--icon-left fr-icon-chat-3-line' },
]

const query = ref('')
const { theme } = useScheme() ?? {}
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    service-description="Explorez, trouvez, comprenez"
    :logo-text="['République', 'Française']"
    home-to="/"
    :quick-links="quickLinks"
  />

  <main id="main-content" class="fr-container fr-my-4w">
    <DsfrSearchBar
      v-model="query"
      label="Rechercher un document"
      placeholder="Explorez, trouvez, comprenez"
      large
    />
    <DsfrAlert
      class="fr-mt-4w"
      type="info"
      title="Socle en place"
      :description="`Vue 3 + DSFR opérationnels (thème courant : ${theme ?? 'n/a'}).`"
    />
  </main>
</template>
