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
import { useUiConfigStore } from '@/stores/uiConfig'

/**
 * Plusieurs sections ci-dessous décrivent des fonctionnalités que
 * l'administration peut suspendre. Elles ne s'affichent que si elle les
 * a activées : une aide qui décrit une commande absente de l'écran est
 * pire que pas d'aide — c'est déjà la règle appliquée aux raccourcis
 * clavier (voir SHORTCUTS dans constants.ts).
 */
const uiConfig = useUiConfigStore()

const operators: [string, string, string][] = [
  ['auteur:', 'auteur:"Jean Dupont"', 'Facette Auteur'],
  ['mots-cles:', 'mots-cles:urgent', 'Facette Mots-clés'],
  ['type:', 'type:pdf', 'Facette Type de fichier'],
  ['source:', 'source:documents', 'Facette Source'],
  ['dossier:', 'dossier:Finance', 'Facette Dossier'],
]
</script>

<template>
  <div id="aide" class="ds-help">
    <h2 id="aide-raccourcis" class="fr-h5">Raccourcis clavier</h2>
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="aide-raccourcis-tableau">
        <thead>
          <tr><th scope="col">Raccourci</th><th scope="col">Action</th></tr>
        </thead>
        <tbody>
          <tr v-for="shortcut in SHORTCUTS" :key="shortcut.keys" data-testid="aide-raccourci">
            <td><kbd>{{ shortcut.keys }}</kbd></td>
            <td>{{ shortcut.label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="fr-hint-text">
      Inactifs pendant la saisie dans un champ de texte ou une liste déroulante.
    </p>

    <h2 id="aide-syntaxe" class="fr-h5">Syntaxe avancée (barre de recherche)</h2>
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
      <table id="aide-operateurs-tableau">
        <thead>
          <tr>
            <th scope="col">Opérateur</th>
            <th scope="col">Exemple</th>
            <th scope="col">Équivaut à</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[op, example, equiv] in operators" :key="op" data-testid="aide-operateur">
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

    <h3 id="aide-facettes-personnalisees" class="fr-h6">Facettes personnalisées</h3>
    <p>
      Certaines sources (bases de données SQL) ajoutent leurs propres facettes — elles
      deviennent automatiquement des opérateurs supplémentaires, reconnus par leur nom de
      champ (visible dans la colonne de gauche une fois une facette de ce type dépliée).
      Sur cette installation par exemple&nbsp;: <code>bureau:Paris</code> ou
      <code>fonction:"Chef de service"</code>. Mêmes règles que ci-dessus (correspondance
      exacte, guillemets si espaces).
    </p>

    <h2 id="aide-recherche-exacte" class="fr-h5">Recherche exacte et synonymes</h2>
    <p>
      Par défaut, la recherche tolère les fautes de frappe et les variantes d'un mot.
      Entourer la requête de guillemets (<code>"délégation de service"</code>) force au
      contraire une correspondance <strong>exacte</strong>&nbsp;: mêmes mots, dans le même
      ordre, sans tolérance.
    </p>
    <p>
      Votre administration peut par ailleurs déclarer des <strong>synonymes</strong> propres
      à votre organisation — un sigle et son développé, l'ancien et le nouveau nom d'un
      service. Chercher l'un ramène alors les documents qui portent l'autre, sans que vous
      ayez rien à faire. ⚠️ Cet élargissement ne s'applique <strong>pas</strong> à une
      recherche entre guillemets&nbsp;: « exact » veut dire exact.
    </p>

    <h2 id="aide-partager" class="fr-h5">Partager et retrouver une recherche</h2>
    <p>
      L'adresse de la page suit votre recherche&nbsp;: filtres, période, tri et numéro de
      page y figurent. Vous pouvez donc la mettre en signet, la recharger (F5) sans rien
      perdre, revenir à la recherche précédente avec le bouton Précédent du navigateur, ou
      l'envoyer à un collègue — le bouton <strong>« Copier le lien »</strong>, au-dessus des
      résultats, la copie telle quelle.
    </p>
    <p class="fr-hint-text">
      ⚠️ Un lien partage la <strong>recherche</strong>, pas les droits d'accès&nbsp;: votre
      correspondant la rejoue avec les siens et peut donc voir moins de résultats que vous —
      ou davantage.
    </p>

    <template v-if="uiConfig.config.autocomplete_enabled || uiConfig.config.search_history_enabled || uiConfig.config.recent_documents_enabled">
      <h2 id="aide-mon-activite" class="fr-h5">Retrouver ce que vous avez déjà fait</h2>
      <ul>
        <li v-if="uiConfig.config.autocomplete_enabled">
          <strong>Suggestions de saisie</strong>&nbsp;: dès deux caractères, une liste
          s'ouvre sous la barre de recherche — d'abord vos propres recherches passées, puis
          les auteurs et mots-clés présents dans les documents auxquels vous avez accès.
          Se parcourt aux flèches ↑&nbsp;↓, se valide à Entrée, se ferme à Échap. Retenir un
          auteur ou un mot-clé pose la puce de filtre correspondante.
        </li>
        <li v-if="uiConfig.config.search_history_enabled">
          <strong>« Mes recherches récentes »</strong> (barre de navigation)&nbsp;: vos
          dernières recherches, dédoublonnées, relançables d'un clic.
        </li>
        <li v-if="uiConfig.config.recent_documents_enabled">
          <strong>« Vos derniers documents consultés »</strong>, sur l'écran d'accueil, tant
          qu'aucune recherche n'est lancée.
        </li>
      </ul>
      <p class="fr-hint-text">
        Ces trois listes ne montrent que <strong>votre</strong> activité&nbsp;: personne
        d'autre ne voit vos recherches, et vous ne voyez pas celles des autres.
      </p>
    </template>

    <template v-if="uiConfig.config.collections_enabled">
      <h2 id="aide-collections" class="fr-h5">Collections</h2>
      <p>
        Une collection regroupe des documents choisis, indépendamment d'une recherche —
        « Dossier client X », « À lire ». Elle ne contient que des références&nbsp;: les
        documents eux-mêmes ne sont ni copiés, ni déplacés.
      </p>
      <p v-if="uiConfig.config.collections_shared_enabled">
        Vous pouvez partager une collection avec l'un de vos groupes. ⚠️ Partager donne la
        <strong>référence</strong>, pas le droit de lecture&nbsp;: chacun n'y voit que les
        documents auxquels il a accès, et l'écran indique le nombre de documents qui lui
        restent inaccessibles. Seul le propriétaire modifie une collection&nbsp;; les autres
        peuvent la <strong>dupliquer</strong> pour en obtenir leur propre version.
      </p>
    </template>

    <h2 id="aide-resultats-proposes" class="fr-h5">« Proposé par votre administration »</h2>
    <p>
      Sur certaines recherches courantes, un ou plusieurs documents apparaissent en tête,
      sous cette mention&nbsp;: votre administration les a désignés comme la bonne réponse à
      cette question. Ils restent soumis à vos droits d'accès comme n'importe quel autre
      résultat.
    </p>

    <h2 id="aide-contact" class="fr-h5">Besoin d'aide&nbsp;?</h2>
    <p>Contactez l'équipe technique pour toute question sur l'utilisation de DocSearch.</p>
    <!-- Version en toutes lettres, à recopier dans un signalement. Ici
         plutôt que dans le seul pied de page, que l'administration peut
         désactiver (`footer_enabled`) : un utilisateur qui signale un
         problème doit toujours pouvoir dire sur quelle version. -->
    <p id="aide-version" class="fr-hint-text">{{ versionComplete }}</p>
  </div>
</template>
