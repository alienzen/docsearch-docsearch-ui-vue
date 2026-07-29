<script setup lang="ts">
// Portage de docsearch-ui/public/help.html. Le contenu est repris tel
// quel ; seule la présentation change (composants et classes DSFR au
// lieu du <style> maison de 35 lignes).
//
// La configuration est chargée uniquement pour la marque : sans elle,
// cette page afficherait le bloc-marque générique pendant que les autres
// affichent celui de l'installation.
import { onMounted } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'

const uiConfig = useUiConfigStore()
onMounted(() => uiConfig.loadUiConfig())

const shortcuts: [string, string][] = [
  ['/', 'Mettre le focus sur la barre de recherche'],
  ['Échap', 'Fermer la fenêtre ou le panneau ouvert'],
  ['↑ / ↓', 'Parcourir la liste des résultats'],
  ['← / →', 'Page de résultats précédente / suivante'],
  ['Entrée', 'Déplier/replier le résultat sélectionné'],
  ['c', 'Basculer la vue compacte des résultats'],
  ['s', 'Enregistrer la recherche en cours'],
  ['r', 'Effacer tous les filtres'],
  ['n', 'Réinitialiser la recherche (requête, filtres et tri)'],
  ['h', 'Retourner en haut de la page et sélectionner le 1er résultat'],
  ['?', 'Ouvrir cette aide'],
]

const operators: [string, string, string][] = [
  ['auteur:', 'auteur:"Jean Dupont"', 'Facette Auteur'],
  ['mots-cles:', 'mots-cles:urgent', 'Facette Mots-clés'],
  ['type:', 'type:pdf', 'Facette Type de fichier'],
  ['source:', 'source:documents', 'Facette Source'],
  ['dossier:', 'dossier:Finance', 'Facette Dossier'],
]
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    service-description="Explorez, trouvez, comprenez"
    :logo-text="uiConfig.logoText"
    home-to="/"
    :quick-links="[
      {
        label: 'Retour à la recherche',
        to: '/',
        class: 'fr-link--icon-left fr-icon-arrow-left-line',
      },
    ]"
  />

  <main id="main-content" class="fr-container ds-prose fr-my-4w">
    <h1 class="fr-h3">Aide</h1>

    <h2 class="fr-h5">Raccourcis clavier (page de recherche)</h2>
    <div class="fr-table fr-table--bordered">
      <table>
        <thead>
          <tr><th scope="col">Raccourci</th><th scope="col">Action</th></tr>
        </thead>
        <tbody>
          <tr v-for="[key, action] in shortcuts" :key="key">
            <td><kbd>{{ key }}</kbd></td>
            <td>{{ action }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 class="fr-h5">Syntaxe avancée (barre de recherche)</h2>
    <p>
      En plus des facettes de la colonne de gauche, ces opérateurs peuvent être tapés
      directement dans la barre de recherche, combinés entre eux et avec du texte libre —
      ex&nbsp;: <code>type:pdf auteur:"Jean Dupont" rapport annuel</code>. Une fois la
      recherche lancée, ils disparaissent de la barre et deviennent des puces de filtre
      (comme un clic sur la facette correspondante) — la valeur doit donc correspondre
      exactement à ce qu'affiche la facette (pas de recherche approximative sur ces
      champs-là).
    </p>
    <div class="fr-table fr-table--bordered">
      <table>
        <thead>
          <tr>
            <th scope="col">Opérateur</th>
            <th scope="col">Exemple</th>
            <th scope="col">Équivaut à</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[op, example, equiv] in operators" :key="op">
            <td><code>{{ op }}</code></td>
            <td><code>{{ example }}</code></td>
            <td>{{ equiv }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="fr-hint-text">
      La valeur peut tenir en un seul mot (<code>type:pdf</code>) ou être entre guillemets
      si elle contient des espaces (<code>auteur:"Jean Dupont"</code>). Un opérateur seul,
      sans texte libre, cherche tous les documents correspondant à ce filtre.
    </p>

    <h3 class="fr-h6">Facettes personnalisées</h3>
    <p>
      Certaines sources (bases de données SQL) ajoutent leurs propres facettes — elles
      deviennent automatiquement des opérateurs supplémentaires, reconnus par leur nom de
      champ (visible dans la colonne de gauche une fois une facette de ce type dépliée).
      Sur cette installation par exemple&nbsp;: <code>bureau:Paris</code> ou
      <code>fonction:"Chef de service"</code>. Mêmes règles que ci-dessus (correspondance
      exacte, guillemets si espaces).
    </p>

    <h2 class="fr-h5">Besoin d'aide&nbsp;?</h2>
    <p>Contactez l'équipe technique pour toute question sur l'utilisation de DocSearch.</p>
  </main>
</template>
