<script setup lang="ts">
/**
 * Contenu de l'aide de la recherche, rendu par la page autonome /help —
 * dont l'URL reste partageable et que le lien « Aide » de l'en-tête
 * ouvre dans un nouvel onglet.
 *
 * Écrit une seule fois : docsearch-ui dupliquait ce contenu entre
 * help.html et la modale d'aide de init.js, et les deux avaient déjà
 * commencé à diverger.
 *
 * Les raccourcis viennent de SHORTCUTS, partagés avec la palette et les
 * infobulles des commandes.
 */
import { SHORTCUTS } from '@/constants'
import { versionComplete } from '@/version'

const operators: [string, string, string][] = [
  ['auteur:', 'auteur:"Jean Dupont"', 'Facette Auteur'],
  ['mots-cles:', 'mots-cles:urgent', 'Facette Mots-clés'],
  ['type:', 'type:pdf', 'Facette Type de fichier'],
  ['source:', 'source:documents', 'Facette Source'],
  ['dossier:', 'dossier:Finance', 'Facette Dossier'],
]
</script>

<template>
  <div class="ds-help">
    <h2 class="fr-h5">Raccourcis clavier</h2>
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table>
        <thead>
          <tr><th scope="col">Raccourci</th><th scope="col">Action</th></tr>
        </thead>
        <tbody>
          <tr v-for="shortcut in SHORTCUTS" :key="shortcut.keys">
            <td><kbd>{{ shortcut.keys }}</kbd></td>
            <td>{{ shortcut.label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="fr-hint-text">
      Inactifs pendant la saisie dans un champ de texte ou une liste déroulante.
    </p>

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
    <div class="fr-table fr-table--bordered ds-stats__table">
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
    <!-- Version en toutes lettres, à recopier dans un signalement. Ici
         plutôt que dans le seul pied de page, que l'administration peut
         désactiver (`footer_enabled`) : un utilisateur qui signale un
         problème doit toujours pouvoir dire sur quelle version. -->
    <p class="fr-hint-text">{{ versionComplete }}</p>
  </div>
</template>
