<script setup lang="ts">
/**
 * Tableau « répartition par groupe » — un décompte simple, partagé par les
 * panneaux qui n'ont qu'un nombre à ventiler (recherches sans résultat,
 * suggestions).
 *
 * Les panneaux Avis et NPS gardent leur propre tableau : ils ventilent
 * plusieurs colonnes et un score calculé, que ce composant ne saurait
 * rendre sans devenir un gabarit générique illisible.
 *
 * La mise en garde sur le double compte est ici, et non chez l'appelant :
 * elle vaut pour toute agrégation par groupe, et l'oublier une fois
 * suffirait à faire lire les chiffres de travers.
 */
import { computed } from 'vue'
import { groupLabel, type CountByGroup } from '@/api/stats'

const props = withDefaults(
  defineProps<{
    /**
     * Identifiant du tableau, passé par le panneau appelant : ce
     * composant est instancié plusieurs fois dans la même page, un
     * identifiant écrit en dur ici se retrouverait donc en double.
     */
    id: string
    /**
     * Facultatif à dessein : une réponse d'API sans `by_group` — version
     * antérieure, ou champ absent — ne doit pas faire planter le rendu du
     * panneau entier. Le tableau disparaît simplement.
     */
    rows?: CountByGroup[]
    title: string
    /** Intitulé de la colonne de décompte. */
    countLabel: string
  }>(),
  { rows: () => [] },
)

/** Les groupes les plus représentés d'abord. */
const sorted = computed(() => [...(props.rows || [])].sort((a, b) => b.count - a.count))
</script>

<template>
  <template v-if="sorted.length">
    <h3 :id="`${id}-titre`" class="fr-h6 fr-mt-3w">{{ title }}</h3>
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table :id="id">
        <thead>
          <tr>
            <th scope="col">Groupe</th>
            <th scope="col">{{ countLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in sorted" :key="row.group" data-testid="groupe-ligne">
            <td>{{ groupLabel(row.group) }}</td>
            <td>{{ row.count.toLocaleString('fr-FR') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="fr-hint-text fr-mt-1w">
      Un utilisateur appartenant à plusieurs groupes compte dans chacun : la
      somme des lignes dépasse donc le total.
      <!-- Le détail de ce que recouvre « Non renseigné » diffère d'un
           panneau à l'autre : les suggestions y rangent aussi celles
           déposées anonymement. D'où ce slot plutôt qu'un texte figé. -->
      <slot name="note" />
    </p>
    <p class="fr-hint-text">
      Aucun effectif minimum n'est appliqué : dans un groupe très restreint,
      ces chiffres peuvent désigner une personne.
    </p>
  </template>
</template>
