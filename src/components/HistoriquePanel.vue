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
import { ref, watch } from 'vue'
import { listerRecherchesRecentes, type RechercheRecente } from '@/api/historique'
import { useSearchStore } from '@/stores/search'
import { useUiConfigStore } from '@/stores/uiConfig'

const store = useSearchStore()
const uiConfig = useUiConfigStore()

const liste = ref<RechercheRecente[]>([])
const chargement = ref(false)
const erreur = ref<string | null>(null)

const menu = ref<{ close: () => void } | null>(null)

async function charger() {
  // La bascule peut être à `false` : appeler la route donnerait un 403,
  // affiché comme une erreur alors que rien n'est cassé.
  if (!uiConfig.config.search_history_enabled) {
    liste.value = []
    return
  }
  chargement.value = true
  erreur.value = null
  try {
    liste.value = (await listerRecherchesRecentes(10)).searches
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : String(e)
  } finally {
    chargement.value = false
  }
}

/**
 * Chargé quand la configuration arrive, et non au montage : /ui-config
 * est encore en vol à ce moment-là, et la bascule y vaut `false` par
 * défaut — l'entrée ne serait jamais apparue.
 */
watch(() => uiConfig.config.search_history_enabled, charger, { immediate: true })

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
  </NavMenuItem>
</template>
