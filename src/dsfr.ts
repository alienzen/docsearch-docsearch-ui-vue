// Socle commun à toutes les entrées HTML (index, help, et plus tard
// chat/admin/stats). Chaque page appelle createDocsearchApp() plutôt
// que createApp() directement, pour partager styles DSFR et plugins.
import { createApp, type Component } from 'vue'
import { createPinia } from 'pinia'
import { VIcon } from '@gouvminint/vue-dsfr'
import RouterLinkShim from './components/RouterLinkShim.vue'

// Feuille "main" (sans la partie legacy destinée à IE) + les styles
// propres aux composants Vue de vue-dsfr. Les polices Marianne sont
// embarquées ici — inutile de recopier les .woff2 à la main comme le
// faisait docsearch-ui.
import '@gouvfr/dsfr/dist/dsfr.main.css'
import '@gouvminint/vue-dsfr/styles'

// Icônes : familles importées UNE PAR UNE, volontairement.
//
// `utility/utility.main.css` (le réflexe habituel) embarque les ~1200
// icônes DSFR en data-URI, soit 1,4 Mo de CSS pour la dizaine qu'on
// utilise réellement — à lui seul, il triplait le poids de la feuille.
// Chaque famille ne pèse ici que 10 à 30 ko.
//
// Les familles ci-dessous couvrent aussi les icônes que les composants
// vue-dsfr affichent d'eux-mêmes (chevrons de DsfrPagination, coche de
// DsfrCheckbox, croix de fermeture des modales). Symptôme d'une famille
// manquante : une icône qui n'apparaît pas, sans erreur en console —
// ajouter alors la ligne d'import correspondante.
// NB : les utilitaires d'espacement (fr-mt-*, fr-my-*...) ne sont PAS
// concernés, ils vivent dans dsfr.main.css importé ci-dessus.
import '@gouvfr/dsfr/dist/utility/icons/icons-system/icons-system.main.css'
import '@gouvfr/dsfr/dist/utility/icons/icons-arrows/icons-arrows.main.css'
import '@gouvfr/dsfr/dist/utility/icons/icons-communication/icons-communication.main.css'
import '@gouvfr/dsfr/dist/utility/icons/icons-user/icons-user.main.css'

import './assets/app.css'

export function createDocsearchApp(root: Component) {
  const app = createApp(root)
  app.use(createPinia())
  // NB : volontairement PAS `app.use(VueDsfr)` — son install() enregistre
  // globalement les ~90 composants de la bibliothèque, ce qui les
  // embarque tous dans le bundle. Les `<Dsfr*/>` sont importés à la
  // demande par unplugin-vue-components (voir le resolver de
  // vite.config.ts). Seul VIcon, référencé par nom depuis les templates
  // de vue-dsfr, doit être enregistré globalement.
  app.component('VIcon', VIcon)
  // Navigation pleine page pour les liens internes rendus par vue-dsfr
  // (voir le commentaire détaillé dans RouterLinkShim.vue).
  app.component('RouterLink', RouterLinkShim)
  return app
}
