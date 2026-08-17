<script setup lang="ts">
/**
 * Requêtes ayant retourné zéro résultat, les plus fréquentes d'abord.
 * Simple « top N », sans pagination : au-delà d'une cinquantaine de
 * requêtes distinctes, ce sont les plus fréquentes qui comptent, pas
 * l'exhaustivité.
 */
import { getZeroResults, type ZeroResultQuery } from '@/api/stats'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { SEARCH_IN_LABELS } from '@/constants'
import { extLabel, fmtDateTime } from '@/utils/format'

const { data, error } = useStatsPanel(getZeroResults)

/**
 * Critères d'une ligne, liste vide si la réponse n'en porte pas.
 *
 * Ce repli n'est pas de la prudence de principe : l'interface et l'API
 * sont deux conteneurs redémarrés SÉPARÉMENT (`manage.sh restart`), et
 * une interface neuve devant une API pas encore reconstruite reçoit donc
 * l'ancienne forme de réponse. Sans ce repli, `criteres.length` lève —
 * et le rendu de Vue échouant, c'est la page de statistiques ENTIÈRE qui
 * disparaît, pas seulement la colonne manquante.
 */
function criteresDe(row: ZeroResultQuery) {
  return row.criteres || []
}

/** Nom du champ du journal → intitulé de la colonne « Affiner ». */
const CHAMP_LABELS: Record<string, string> = {
  extension: 'Type',
  author: 'Auteur',
  folder: 'Dossier',
  keywords: 'Mot-clé',
  source: 'Source',
  search_in: 'Recherche dans',
  periode: 'Période',
}

/**
 * Un critère, tel qu'il s'affiche : « Type : PDF », « Période ».
 *
 * `periode` n'a pas de valeur — seule sa présence a été agrégée, une
 * ventilation par date choisie n'aurait produit qu'une ligne par jour
 * (voir _zero_result_criteria côté API).
 */
function libelleCritere(critere: ZeroResultQuery['criteres'][number]): string {
  const champ = CHAMP_LABELS[critere.champ] || critere.champ
  if (!critere.valeur) return champ
  if (critere.champ === 'extension') return `${champ} : ${extLabel(critere.valeur)}`
  if (critere.champ === 'search_in') {
    return `${champ} : ${SEARCH_IN_LABELS[critere.valeur] || critere.valeur}`
  }
  return `${champ} : ${critere.valeur}`
}
</script>

<template>
  <StatsPanel
    id="zero-results-panel"
    title="Recherches sans résultat"
    :subtitle="
      data ? `${data.total_zero_result_searches.toLocaleString('fr-FR')} recherche(s) au total` : ''
    "
    :error="error"
  >
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="zero-results-tableau">
        <thead>
          <tr>
            <th scope="col">Requête</th>
            <th scope="col">Occurrences</th>
            <th scope="col">Critères rencontrés</th>
            <th scope="col">Dernière fois</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!data?.results.length">
            <td colspan="4" class="fr-hint-text">Aucune recherche sans résultat pour l'instant.</td>
          </tr>
          <tr v-for="row in data?.results || []" :key="row.query" data-testid="zero-result-ligne">
            <td>{{ row.query }}</td>
            <td>{{ row.count }}</td>
            <td>
              <ul class="ds-stats__criteres">
                <li v-for="critere in criteresDe(row)" :key="`${critere.champ}-${critere.valeur}`">
                  <span class="fr-tag fr-tag--sm" data-testid="zero-result-critere">
                    {{ libelleCritere(critere) }}
                    <span class="fr-hint-text">({{ critere.count }})</span>
                  </span>
                </li>
                <!-- Le compte qui donne son sens aux autres : une requête
                     dont TOUTES les occurrences étaient filtrées appelle
                     une correction de filtre, la même requête lancée sans
                     filtre appelle du contenu. -->
                <li v-if="row.sans_critere">
                  <span class="fr-tag fr-tag--sm" data-testid="zero-result-sans-critere">
                    Sans filtre
                    <span class="fr-hint-text">({{ row.sans_critere }})</span>
                  </span>
                </li>
                <li v-if="!criteresDe(row).length && !row.sans_critere" class="fr-hint-text">—</li>
              </ul>
            </td>
            <td>{{ fmtDateTime(row.last_seen) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="fr-hint-text fr-mt-1w">
      Les critères sont ceux rencontrés avec la requête, toutes occurrences confondues :
      leurs comptes ne s'additionnent pas jusqu'aux occurrences de la ligne — une recherche
      portant deux filtres compte dans les deux, une recherche sans filtre ne compte que
      dans « Sans filtre ». « Recherche dans » n'apparaît que lorsque la recherche était
      restreinte à un champ ; au-delà de cinq valeurs distinctes pour un même critère,
      seules les plus fréquentes sont montrées.
    </p>

    <StatsGroupCounts
      v-if="data"
      id="zero-results-groupes"
      :rows="data.by_group"
      title="Recherches sans résultat par groupe"
      count-label="Recherches"
    >
      <template #note>
        « Non renseigné » regroupe les recherches antérieures à la capture des
        groupes.
      </template>
    </StatsGroupCounts>
  </StatsPanel>
</template>
