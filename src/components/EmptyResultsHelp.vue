<script setup lang="ts">
/**
 * Écran « aucun résultat », en état de servir à quelque chose.
 *
 * L'administration voyait déjà la liste des recherches infructueuses
 * (page Statistiques) ; l'utilisateur, lui, n'avait qu'une phrase. Le
 * diagnostic existait, l'aide non.
 *
 * Trois pistes, dans l'ordre où elles servent, et toutes fournies par
 * l'API (voir `_aide_zero_resultat`) : la correction orthographique, le
 * relâchement d'un filtre, les autres sources.
 *
 * ⚠️ Les comptes affichés viennent de l'API, qui les a calculés SOUS
 * L'ACL de l'utilisateur : « 12 résultats sans ce filtre » est un
 * nombre atteignable, pas une promesse. Ne jamais recalculer ces
 * comptes ici à partir des facettes, qui ne portent pas la même chose.
 *
 * À ne pas confondre avec `EmptySearchState`, qui est l'état d'AVANT
 * toute recherche — inviter à chercher et rattraper une recherche ratée
 * sont deux écrans différents.
 */
import { computed } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { extLabel } from '@/utils/format'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const aide = computed(() => store.zeroResult)

/**
 * Nom interne du filtre → ce qu'on en dit, et comment on le retire.
 *
 * Un champ absent de cette table n'est PAS rendu : proposer un bouton
 * dont on ne saurait pas honorer le clic serait pire que ne rien
 * proposer. C'est notamment le cas de `has_attachments`, que l'API sait
 * filtrer mais que cette interface ne pose jamais.
 */
const RETRAITS: Record<string, { libelle: () => string; retirer: () => void }> = {
  extension: {
    libelle: () => `le type ${store.ext.map(extLabel).join(', ')}`,
    retirer: () => (store.ext = []),
  },
  author: {
    libelle: () => `l'auteur ${store.author.join(', ')}`,
    retirer: () => (store.author = []),
  },
  keywords: {
    libelle: () => `les mots-clés ${store.keywords.join(', ')}`,
    retirer: () => (store.keywords = []),
  },
  folder: {
    libelle: () => `le dossier ${store.folder.join(', ')}`,
    retirer: () => (store.folder = []),
  },
  source: {
    libelle: () => `la source ${store.source.map(uiConfig.sourceLabel).join(', ')}`,
    retirer: () => (store.source = []),
  },
  date: {
    libelle: () => 'la période',
    retirer: () => {
      store.dateFrom = null
      store.dateTo = null
    },
  },
  __all__: {
    libelle: () => 'tous les filtres',
    retirer: () => {
      store.ext = []
      store.author = []
      store.keywords = []
      store.folder = []
      store.source = []
      store.custom = {}
      store.dateFrom = null
      store.dateTo = null
    },
  },
}

function retrait(field: string) {
  if (RETRAITS[field]) return RETRAITS[field]
  // Facette personnalisée d'une source SQL : son nom vient de la
  // configuration de la source, pas d'une liste fermée.
  if (field.startsWith('custom:')) {
    const champ = field.slice('custom:'.length)
    return {
      libelle: () =>
        `${uiConfig.customFacetLabels[champ] || champ} ${(store.custom[champ] || []).join(', ')}`,
      retirer: () => {
        const suite = { ...store.custom }
        delete suite[champ]
        store.custom = suite
      },
    }
  }
  return null
}

/** Les relâchements qu'on sait à la fois nommer et honorer. */
const relachements = computed(() =>
  (aide.value?.relaxations || [])
    .map((r) => ({ ...r, retrait: retrait(r.field) }))
    .filter((r) => r.retrait !== null),
)

function pluriel(n: number): string {
  return `${n} résultat${n > 1 ? 's' : ''}`
}

function relacher(field: string) {
  retrait(field)?.retirer()
  store.searchFromFirstPage('empiler')
}

function corriger() {
  if (!aide.value?.suggestion) return
  store.query = aide.value.suggestion
  store.searchFromFirstPage('empiler')
}

function chercherDans(source: string) {
  store.source = [source]
  store.searchFromFirstPage('empiler')
}
</script>

<template>
  <div id="resultats-vides" class="fr-mb-2w">
    <p class="fr-text--sm">Aucun résultat ne correspond à ces critères.</p>

    <template v-if="aide">
      <p v-if="aide.suggestion" class="fr-mb-1w">
        Vouliez-vous dire
        <DsfrButton
          id="zero-correction"
          size="sm"
          tertiary
          no-outline
          :label="`« ${aide.suggestion} »`"
          @click="corriger"
        />
        ?
      </p>

      <template v-if="relachements.length">
        <p class="fr-text--sm fr-mb-1w">En retirant un filtre :</p>
        <ul class="fr-btns-group fr-btns-group--sm fr-btns-group--inline-sm fr-mb-2w">
          <li v-for="r in relachements" :key="r.field">
            <DsfrButton
              secondary
              size="sm"
              data-testid="zero-relachement"
              :data-champ="r.field"
              :label="`Sans ${r.retrait!.libelle()} — ${pluriel(r.count)}`"
              @click="relacher(r.field)"
            />
          </li>
        </ul>
      </template>

      <template v-if="aide.sources.length">
        <p class="fr-text--sm fr-mb-1w">Dans une autre source :</p>
        <ul class="fr-btns-group fr-btns-group--sm fr-btns-group--inline-sm fr-mb-2w">
          <li v-for="bucket in aide.sources" :key="bucket.key">
            <DsfrButton
              secondary
              size="sm"
              data-testid="zero-source"
              :data-source="bucket.key"
              :label="`${uiConfig.sourceLabel(bucket.key)} — ${pluriel(bucket.doc_count)}`"
              @click="chercherDans(bucket.key)"
            />
          </li>
        </ul>
      </template>
    </template>

    <!-- Toujours affiché, aide de l'API ou non : quand elle n'a rien à
         proposer, c'est justement là que la syntaxe avancée sert. -->
    <p v-if="uiConfig.config.help_enabled" class="fr-text--sm fr-mb-0">
      <a class="fr-link fr-link--sm" href="/help">Voir l'aide à la recherche</a>
    </p>
  </div>
</template>
