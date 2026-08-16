<script setup lang="ts">
/**
 * Écran hôte des modules complémentaires (accroche `page`).
 *
 * UNE seule page pour tous les modules, le module visé arrivant en
 * paramètre — `/module.html?m=jira`. Une page par module serait
 * impossible : le paquet de l'interface est construit avant qu'aucun
 * module n'existe.
 *
 * Le cœur n'apporte que le cadre : en-tête, titre, retour à la
 * recherche. L'écran lui-même est servi par le module, sous
 * /ext/<nom>/, et affiché dans une iframe.
 *
 * ⚠️ L'iframe n'est PAS une barrière de sécurité, et il ne faut pas le
 * croire. Elle est de MÊME ORIGINE que l'application — le module est
 * servi sous le même hôte, c'est ce qui lui permet de recevoir le cookie
 * de session et donc de savoir qui parle. Ce qu'elle apporte est le
 * cadre et le confinement de la MISE EN PAGE, plus l'interdiction de
 * détourner la navigation de l'onglet (`allow-top-navigation` est
 * volontairement absent du bac à sable). La véritable protection reste
 * ailleurs : un module ne lit jamais Elasticsearch, il repasse par l'API
 * avec le jeton de l'utilisateur.
 */
import { computed, onMounted, ref } from 'vue'
import { useUiConfigStore } from '@/stores/uiConfig'
import HeaderUserMenu from '@/components/HeaderUserMenu.vue'

const uiConfig = useUiConfigStore()

/** Module demandé par l'URL. Vide si le paramètre manque. */
const demande = ref(new URLSearchParams(window.location.search).get('m') ?? '')

/**
 * L'écran n'est affiché que s'il est DÉCLARÉ par un module actif : le
 * paramètre d'URL ne suffit pas. Sans ce contrôle, `?m=n-importe-quoi`
 * ferait charger une iframe vers une adresse arbitraire du site.
 */
const page = computed(() =>
  uiConfig.config.plugin_pages.find((p) => p.module === demande.value),
)

const adminLinks = computed(() =>
  uiConfig.showAdminLinks
    ? [
        { label: 'Statistiques', href: '/stats.html', icon: 'fr-icon-bar-chart-line' },
        { label: 'Administration', href: '/admin.html', icon: 'fr-icon-settings-5-line' },
      ]
    : [],
)

onMounted(() => {
  uiConfig.loadUiConfig()
  uiConfig.loadIsAdmin()
})
</script>

<template>
  <DsfrHeader
    service-title="DocSearch"
    :service-description="page?.libelle ?? 'Module complémentaire'"
    :logo-text="uiConfig.logoText"
    home-to="/"
    operator-img-src="/logo-docsearch.svg"
    operator-img-alt="DocSearch"
    operator-img-style="max-width: 2.5rem"
    :quick-links="[
      {
        label: 'Retour à la recherche',
        to: '/',
        class: 'fr-link--icon-left fr-icon-arrow-left-line',
      },
    ]"
  >
    <template #after-quick-links>
      <HeaderUserMenu family="search" :links="adminLinks" />
    </template>
  </DsfrHeader>

  <main id="main-content" class="fr-container fr-my-4w">
    <DsfrAlert
      v-if="!page"
      id="module-inconnu"
      type="warning"
      title="Écran indisponible"
      description="Aucun module actif ne déclare cet écran. Il a peut-être été arrêté ou retiré depuis que ce lien a été copié."
      class="fr-mb-3w"
    />

    <iframe
      v-else
      id="module-cadre"
      :src="page.chemin"
      :title="page.libelle"
      class="ds-module__cadre"
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      data-testid="module-cadre"
    ></iframe>
  </main>
</template>

<style scoped>
/* Une hauteur explicite : une iframe sans dimension se réduit à 150 px,
   et le module y paraîtrait cassé alors qu'il fonctionne. */
.ds-module__cadre {
  width: 100%;
  min-height: 70vh;
  border: 1px solid var(--border-default-grey);
}
</style>
