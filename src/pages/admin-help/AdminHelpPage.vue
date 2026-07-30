<script setup lang="ts">
/**
 * Aide administrateur — portage de
 * docsearch-ui/public/admin-help.html.
 *
 * Contenu repris tel quel, présentation en DSFR. Les raccourcis publiés
 * ici sont ceux réellement branchés par useAdminShortcuts : les tenir
 * synchronisés, une aide qui décrit une touche inopérante est pire que
 * pas d'aide du tout.
 */
import { onMounted } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import { ADMIN_SHORTCUTS } from '@/constants'

const uiConfig = useUiConfigStore()

onMounted(async () => {
  await uiConfig.loadUiConfig()
  uiConfig.applyScheme('admin')
  uiConfig.loadIsAdmin()
})
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    service-description="Aide administrateur"
    :logo-text="uiConfig.logoText"
    home-to="/"
    :quick-links="[
      {
        label: 'Administration',
        to: '/admin.html',
        class: 'fr-link--icon-left fr-icon-settings-5-line',
      },
      // En dernier : le badge se place ainsi tout à droite des outils
      // d'en-tête, à l'écart des liens d'action.
      ...uiConfig.userQuickLinks('admin'),
    ]"
  />

  <main id="main-content" class="fr-container ds-prose fr-my-4w">
    <h1 class="fr-h3">Aide administrateur</h1>

    <h2 class="fr-h5">Raccourcis clavier</h2>
    <div class="fr-table fr-table--bordered">
      <table>
        <thead>
          <tr><th scope="col">Raccourci</th><th scope="col">Action</th></tr>
        </thead>
        <tbody>
          <tr v-for="shortcut in ADMIN_SHORTCUTS" :key="shortcut.keys">
            <td><kbd>{{ shortcut.keys }}</kbd></td>
            <td>{{ shortcut.label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="fr-hint-text">
      Inactifs pendant la saisie dans un champ texte, une liste déroulante ou un formulaire.
    </p>

    <h2 class="fr-h5">Sources</h2>
    <p>
      Les panneaux « Sources fichiers », « Sources SQL » et « Sources web » permettent d'enregistrer
      une source, d'activer ou de désactiver sa visibilité dans la recherche, de modifier son
      libellé et sa description, et de la retirer. Le nom d'une source — utilisé en interne, dans le
      registre et dans les documents déjà indexés — ne peut plus être modifié une fois créé ; seuls
      le libellé affiché et la description peuvent l'être à tout moment.
    </p>

    <h2 class="fr-h5">État des composants</h2>
    <p>
      Vue d'ensemble d'Elasticsearch, Redis, Kafka, Tika et des workers, avec la file d'indexation
      en attente. Ce panneau se rafraîchit seul toutes les 5 secondes ; en cas d'échec passager, il
      conserve les dernières valeurs connues et le signale plutôt que d'afficher une erreur.
    </p>

    <h2 class="fr-h5">Apparence</h2>
    <p>
      L'interface suit le Système de Design de l'État. Le panneau « Interface » ne règle plus que le
      mode clair ou sombre, séparément pour les pages de recherche et d'administration ; les anciens
      thèmes de couleur ont été retirés.
    </p>

    <h2 class="fr-h5">Besoin d'aide&nbsp;?</h2>
    <p>
      Consultez la documentation du projet (<code>docsearch-docs</code>) ou contactez l'équipe
      technique.
    </p>
  </main>

  <!-- Pied de page réduit à l'essentiel : ni liens d'écosystème
       (info.gouv.fr…), ni liens obligatoires, ni licence codée en dur.
       `licence-name` vidé neutralise le lien que DsfrFooter accole
       toujours à la mention de bas de page ; il est masqué en CSS, une
       ancre vide subsistant sinon. -->
  <DsfrFooter
    v-if="uiConfig.config.footer_enabled_admin"
    :logo-text="uiConfig.logoText"
    :desc-text="'DocSearch — Aide administrateur'"
    :licence-text="uiConfig.config.footer_bottom_text"
    licence-name=""
    :mandatory-links="[]"
    :ecosystem-links="[]"
  />
</template>
