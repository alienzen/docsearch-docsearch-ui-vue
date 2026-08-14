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
  // Le seul qui ne remplit pas une facette : il coche la case
  // « Recherche exacte » et laisse son argument dans la barre (voir
  // ADVANCED_QUERY_MODES dans api/search.ts). D'où la colonne
  // « Équivaut à » qui désigne une case et non une facette.
  ['exact:', 'exact:"délégation de service"', 'Case Recherche exacte'],
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
    <p>
      <code>exact:</code> fait exception&nbsp;: il ne pose pas de filtre mais coche la case
      <strong>« Recherche exacte »</strong>, et son argument <em>reste</em> dans la barre —
      c'est ce que vous cherchez, pas un critère sur une facette. Voir
      <a class="fr-link" href="#aide-recherche-exacte">Recherche exacte et synonymes</a>.
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
      Par défaut, la recherche tolère les variantes d'un mot&nbsp;: chercher
      <code>délégation</code> ramène aussi <code>délégations</code>. Elle rattrape également
      une lettre fausse, manquante ou en trop, mais seulement <strong>à partir de cinq
      lettres</strong>&nbsp;: en dessous, une lettre d'écart fait déjà un autre mot
      (<code>loi</code> et <code>roi</code>), et le rattrapage ramènerait plus de bruit que
      de documents. Deux moyens de resserrer la recherche, qui répondent à deux questions
      différentes et se combinent&nbsp;:
    </p>
    <ul>
      <li>
        <strong>Les guillemets</strong> (<code>"délégation de service"</code>) disent
        <em>ces mots, dans cet ordre</em>. Ils portent sur l'enchaînement des mots.
      </li>
      <li>
        <strong>La case « Recherche exacte »</strong>, à côté de la barre de recherche, dit
        <em>ces mots, tels que je les écris</em>&nbsp;: ni variantes, ni synonymes, ni
        rattrapage des fautes de frappe. Elle porte sur chaque mot pris isolément.
      </li>
    </ul>
    <p>
      La case à cocher <strong>ignore les accents et les majuscules</strong>&nbsp;:
      <code>Congrès</code>, <code>congres</code> et <code>CONGRES</code> y sont une seule et
      même recherche. Il s'agit d'être fidèle aux <em>mots</em>, pas à la façon dont ils ont
      été saisis — un document scanné ou importé depuis une base ancienne perd souvent ses
      accents, et il n'y a aucune raison de le rendre introuvable pour autant.
    </p>
    <p>
      Vous pouvez aussi l'activer depuis la barre elle-même, avec l'opérateur
      <code>exact:</code>&nbsp;— <code>exact:"délégation de service"</code> coche la case et
      cherche cette expression. Les deux gestes produisent exactement la même recherche.
    </p>
    <p>
      Votre administration peut par ailleurs déclarer des <strong>synonymes</strong> propres
      à votre organisation — un sigle et son développé, l'ancien et le nouveau nom d'un
      service. Chercher l'un ramène alors les documents qui portent l'autre, sans que vous
      ayez rien à faire. ⚠️ Cet élargissement ne s'applique <strong>ni</strong> à une
      recherche entre guillemets, <strong>ni</strong> à une recherche exacte&nbsp;: « exact »
      veut dire exact.
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
          dernières recherches, dédoublonnées, relançables d'un clic. La dernière entrée du
          menu les efface.
        </li>
        <li v-if="uiConfig.config.recent_documents_enabled">
          <strong>« Vos derniers documents consultés »</strong>, sur l'écran d'accueil, tant
          qu'aucune recherche n'est lancée. Le lien « Effacer », à côté du titre, vide la
          liste.
        </li>
      </ul>
      <p class="fr-hint-text">
        Ces trois listes ne montrent que <strong>votre</strong> activité&nbsp;: personne
        d'autre ne voit vos recherches, et vous ne voyez pas celles des autres.
      </p>
      <!-- Deux avertissements et non un : effacer ses recherches réécrit
           le journal, effacer ses documents consultés ne fait que vider
           une vue. Les réunir obligerait à une formule assez vague pour
           couvrir les deux, donc fausse pour chacune. -->
      <p v-if="uiConfig.config.search_history_enabled" class="fr-hint-text">
        ⚠️ Effacer vos recherches récentes les retire de cette liste et des suggestions de
        saisie, et les rend <strong>anonymes</strong> dans le journal technique de
        l'application&nbsp;: ni votre compte ni votre poste n'y restent attachés, et les
        documents ouverts depuis ces recherches cessent eux aussi d'être rattachés à vous. Le
        texte cherché y demeure pour les statistiques, ainsi que votre service — les chiffres
        par service continuent d'en tenir compte, sans savoir de qui il s'agit.
        <strong>C'est définitif.</strong>
      </p>
      <p v-if="uiConfig.config.recent_documents_enabled" class="fr-hint-text">
        ⚠️ Effacer vos derniers documents consultés <strong>supprime</strong> ces consultations
        du journal technique&nbsp;: ni le document ouvert ni la date n'y sont conservés. Seul
        leur nombre y reste, pour que les recherches qui vous y ont mené ne passent pas pour
        infructueuses. <strong>C'est définitif</strong>, et vos recherches ne sont pas touchées.
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

    <!-- L'ancre garde son nom : elle peut avoir été copiée dans un lien
         ou un signalement, et un titre qui change ne casse rien, un id
         qui change casse le lien. -->
    <h2 id="aide-resultats-proposes" class="fr-h5">« Résultats mis en avant »</h2>
    <p>
      Sur certaines recherches courantes, un ou plusieurs documents apparaissent en tête,
      sous la mention « Résultats mis en avant pour votre recherche »&nbsp;: votre
      administration les a désignés comme la bonne réponse à cette question. Dans la liste,
      chacun porte le badge « Mis en avant » et un liseré bleu, pour qu'on ne les confonde
      pas avec les résultats classés par le moteur. Ils restent soumis à vos droits d'accès
      comme n'importe quel autre résultat.
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
