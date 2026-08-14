<script setup lang="ts">
/**
 * Panneau « Mes recherches récentes » — l'utilisateur retrouve ce qu'il
 * a lui-même cherché, dédoublonné, la dernière en premier.
 *
 * La donnée existait déjà : chaque recherche est journalisée depuis
 * toujours (index `search_logs`), mais seule l'administration la voyait.
 * Ici, chacun ne voit QUE les siennes — l'API ne prend aucun nom
 * d'utilisateur en paramètre (voir user_history.py).
 *
 * À ne pas confondre avec `SavedSearchesPanel` (« Mes recherches ») :
 * l'une est un enregistrement explicite avec un nom, des critères
 * complets et une alerte possible ; celle-ci est une trace automatique,
 * réduite au texte cherché.
 */
import { computed, ref, watch } from 'vue'
import {
  listerRecherchesRecentes,
  purgerRecherchesRecentes,
  type RechercheRecente,
} from '@/api/historique'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'
import { useDialogs } from '@/composables/useDialogs'

const store = useSearchStore()
const uiConfig = useUiConfigStore()
const { confirm } = useDialogs()

/** Ce que l'API a rendu au dernier chargement. */
const recherches = ref<RechercheRecente[]>([])

/**
 * Les recherches lancées depuis l'ouverture de la page que l'API ne rend
 * pas encore. Elles sont pourtant bien journalisées : Elasticsearch ne
 * rend un document interrogeable qu'à son prochain rafraîchissement (une
 * seconde par défaut), et recharger la liste dans la foulée d'une
 * recherche la retrouve souvent vide. Sans cet appoint, l'entrée de
 * navigation restait invisible jusqu'au rechargement de la page pour qui
 * n'avait encore aucune recherche récente — c'est-à-dire précisément au
 * moment où il vient de s'en faire une.
 *
 * Alimentées sur `searchId`, non sur la soumission : l'API ne le renvoie
 * que lorsque l'écriture du journal a RÉUSSI. Annoncer une ligne
 * d'historique que le journal n'a pas prise serait un mensonge d'écran.
 */
const enAttente = ref<RechercheRecente[]>([])

/** L'appoint d'abord : la liste va de la plus récente à la plus ancienne. */
const liste = computed(() => [...enAttente.value, ...recherches.value])

const chargement = ref(false)
const erreur = ref<string | null>(null)

const menu = ref<{ close: () => void } | null>(null)

async function charger() {
  // La bascule peut être à `false` : appeler la route donnerait un 403,
  // affiché comme une erreur alors que rien n'est cassé.
  if (!uiConfig.config.search_history_enabled) {
    recherches.value = []
    enAttente.value = []
    return
  }
  chargement.value = true
  erreur.value = null
  try {
    recherches.value = (await listerRecherchesRecentes(10)).searches
    // Ce que le moteur rend maintenant n'a plus à être affiché de
    // mémoire, sinon la même recherche figurerait deux fois — une fois
    // avec sa date et son décompte, une fois sans.
    enAttente.value = enAttente.value.filter((attente) => !connue(attente.query))
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : String(e)
  } finally {
    chargement.value = false
  }
}

/** Vrai si l'API rend déjà cette recherche. */
function connue(texte: string): boolean {
  return recherches.value.some((entree) => entree.query === texte)
}

/**
 * Chargé quand la configuration arrive, et non au montage : /ui-config
 * est encore en vol à ce moment-là, et la bascule y vaut `false` par
 * défaut — l'entrée ne serait jamais apparue.
 */
watch(() => uiConfig.config.search_history_enabled, charger, { immediate: true })

/**
 * Une recherche réussie s'ajoute à la liste sans attendre le moteur.
 * `store.query` est le texte libre effectivement envoyé — opérateurs
 * (`type:pdf`) déjà extraits, espaces réduits —, donc exactement ce que
 * l'API journalise et ce qu'elle rendra au prochain chargement.
 *
 * Les recherches sans texte libre (filtres seuls) sont écartées ici comme
 * elles le sont côté API (voir `recent_queries`) : elles n'auraient qu'une
 * ligne vide à afficher.
 */
watch(
  () => store.searchId,
  (id) => {
    if (!id || !uiConfig.config.search_history_enabled) return
    const texte = store.query.trim()
    if (!texte || connue(texte) || enAttente.value.some((e) => e.query === texte)) return
    enAttente.value = [
      { query: texte, count: 1, last: new Date().toISOString() },
      ...enAttente.value,
    ]
  },
)

function relancer(entree: RechercheRecente) {
  menu.value?.close()
  store.query = entree.query
  // `empiler` comme toute soumission : Précédent doit ramener à l'écran
  // d'où la recherche a été relancée.
  store.searchFromFirstPage('empiler')
}

/** « 3 fois » n'a de sens qu'au-delà de une. */
function occurrences(entree: RechercheRecente): string {
  return entree.count > 1 ? `${entree.count} fois` : ''
}

/**
 * Efface la liste. Le message dit exactement ce qui se passe : les
 * recherches sont ANONYMISÉES dans le journal de l'installation — ce qui
 * les rattachait à leur auteur en est ôté pour de bon, le texte cherché
 * y reste pour les statistiques (voir history_purge.py).
 *
 * Trois choses s'y disent parce qu'elles surprendraient sinon : que le
 * texte demeure au journal, que les documents récemment consultés
 * partent avec (ils sont enregistrés dans ces mêmes recherches), et que
 * c'est irréversible. Promettre une disparition totale, ou taire le
 * dommage collatéral, serait un mensonge d'écran.
 */
async function effacer() {
  const ok = await confirm(
    "Vos recherches passées seront rendues anonymes dans le journal de l'installation : " +
      "ni votre compte, ni votre poste, ni votre service n'y resteront attachés. Elles " +
      'disparaîtront de cette liste, des suggestions de saisie et de vos derniers documents ' +
      'consultés, qui sont enregistrés dans ces mêmes recherches. Le texte cherché, lui, reste ' +
      'au journal pour les statistiques, mais plus rien ne le rattachera à vous. ' +
      "C'est définitif.",
    { title: 'Effacer mes recherches récentes', confirmLabel: 'Effacer' },
  )
  if (!ok) return
  erreur.value = null
  try {
    await purgerRecherchesRecentes()
    recherches.value = []
    // L'appoint local part avec le reste : conservé, il ferait survivre à
    // l'effacement la recherche même qui vient d'être lancée.
    enAttente.value = []
    menu.value?.close()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : String(e)
  }
}

function quand(entree: RechercheRecente): string {
  if (!entree.last) return ''
  const date = new Date(entree.last)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR')
}

defineExpose({ reload: charger })
</script>

<template>
  <NavMenuItem
    v-if="uiConfig.config.search_history_enabled && liste.length"
    id="recherches-recentes"
    ref="menu"
    label="Mes recherches récentes"
    @open="charger"
  >
    <li v-if="chargement" class="ds-menu__message">Chargement…</li>
    <li v-else-if="erreur" class="ds-menu__message">
      <DsfrAlert type="error" small :description="erreur" />
    </li>
    <li
      v-for="entree in liste"
      v-else
      :key="entree.query"
      class="ds-menu__entry"
      data-testid="recherche-recente"
    >
      <button
        class="fr-nav__link ds-menu__button"
        data-testid="recherche-recente-relancer"
        @click="relancer(entree)"
      >
        <span class="ds-menu__name">{{ entree.query }}</span>
        <span v-if="quand(entree) || occurrences(entree)" class="fr-hint-text fr-mb-0">
          {{ [quand(entree), occurrences(entree)].filter(Boolean).join(' · ') }}
        </span>
      </button>
    </li>

    <!-- En dernière entrée, et non en tête : une commande destructrice
         ne se place pas là où l'on clique en visant la première
         recherche de la liste. -->
    <li v-if="!chargement && !erreur && liste.length" class="ds-menu__entry">
      <button
        class="fr-nav__link ds-menu__button ds-menu__button--effacer"
        data-testid="recherches-recentes-effacer"
        @click="effacer"
      >
        Effacer mes recherches récentes
      </button>
    </li>
  </NavMenuItem>
</template>
