<script setup lang="ts">
/**
 * Réglages des modules complémentaires.
 *
 * Le cœur ne rend JAMAIS de balisage venu d'un module : celui-ci déclare
 * des réglages typés dans son manifeste (`admin_panel`), et ce composant
 * dessine le formulaire avec les composants DSFR du produit. Trois types,
 * et c'est tout — booléen, texte, liste. Voir
 * docsearch-infra/PLAN-PLUGINS.md §3 pour pourquoi ça ne s'ouvrira pas.
 *
 * ⚠️ Enregistrer n'applique pas. Les variables d'environnement d'un
 * conteneur sont fixées à sa création : tant que `restart_requis` est
 * levé, la valeur affichée n'est pas celle qu'utilise le module. Le dire
 * est la seule chose qui empêche un réglage sans effet de passer pour un
 * réglage appliqué.
 */
import { ref } from 'vue'
import {
  getPlugins,
  setPluginReglages,
  type ModuleComplementaire,
  type ReglageDeclare,
} from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'

const { data, error, refresh } = useStatsPanel(getPlugins)

/** Saisies en cours, par module puis par clé. */
const saisies = ref<Record<string, Record<string, string>>>({})
const enregistre = ref<string | null>(null)
const actionError = ref<string | null>(null)

function valeur(nom: string, module: ModuleComplementaire, reglage: ReglageDeclare): string {
  return saisies.value[nom]?.[reglage.cle] ?? module.reglages[reglage.cle] ?? reglage.defaut
}

function saisir(nom: string, cle: string, valeur: string) {
  saisies.value[nom] = { ...(saisies.value[nom] ?? {}), [cle]: valeur }
}

async function enregistrer(nom: string, module: ModuleComplementaire) {
  actionError.value = null
  enregistre.value = null
  // Toutes les valeurs sont envoyées, pas seulement celles qui ont
  // changé : le module attend un jeu complet, et un envoi partiel
  // laisserait croire qu'un réglage absent vaut sa valeur par défaut.
  const reglages: Record<string, string> = {}
  for (const reglage of module.admin_panel) reglages[reglage.cle] = valeur(nom, module, reglage)
  try {
    await setPluginReglages(nom, reglages)
    saisies.value[nom] = {}
    enregistre.value = nom
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AdminPanel
    id="plugins-panel"
    title="Réglages des modules"
    subtitle="déclarés par chaque module, rendus par le cœur"
    :error="error ? String(error) : null"
  >
    <DsfrAlert
      v-if="actionError"
      type="error"
      :description="actionError"
      small
      class="fr-mb-2w"
      data-testid="modules-erreur"
    />

    <p v-if="data && Object.keys(data).length === 0" class="fr-text--sm">
      Aucun module installé. Voir
      <code>./manage.sh plugin install</code> depuis <code>docsearch-infra</code>.
    </p>

    <div
      v-for="(module, nom) in data ?? {}"
      :key="nom"
      class="fr-mb-3w"
      data-testid="module"
      :data-module="nom"
    >
      <h4 class="fr-h6 fr-mb-1w">
        {{ nom }}
        <!-- La version vient du manifeste installé. Absente pour un
             module installé avant qu'elle soit recopiée dans Redis : on
             le dit, une réinstallation la renseigne. -->
        <span
          class="fr-text--sm fr-text--regular"
          data-testid="module-version"
          :title="module.version ? undefined : `Module installé avant que la version soit publiée : sudo ./manage.sh plugin appliquer ${nom} la renseigne.`"
        >{{ module.version ? `version ${module.version}` : 'version inconnue' }}</span>
        <DsfrBadge :type="module.enabled ? 'success' : 'info'" :label="module.enabled ? 'actif' : 'arrêté'" small />
      </h4>

      <DsfrAlert
        v-if="module.restart_requis"
        type="warning"
        title="Réglages non appliqués"
        :description="`Les valeurs ci-dessous sont enregistrées mais le module tourne encore avec les précédentes. Les appliquer : sudo ./manage.sh plugin appliquer ${nom}`"
        small
        class="fr-mb-2w"
        data-testid="module-redemarrage"
      />

      <p v-if="module.admin_panel.length === 0" class="fr-text--sm fr-mb-0">
        Ce module ne déclare aucun réglage.
      </p>

      <template v-else>
        <div v-for="reglage in module.admin_panel" :key="reglage.cle" class="fr-mb-2w">
          <DsfrCheckbox
            v-if="reglage.type === 'booleen'"
            :model-value="valeur(nom, module, reglage) === 'true'"
            :label="reglage.libelle"
            :hint="reglage.aide ?? undefined"
            :name="`${nom}-${reglage.cle}`"
            :value="reglage.cle"
            @update:model-value="saisir(nom, reglage.cle, $event ? 'true' : 'false')"
          />
          <DsfrInput
            v-else
            :model-value="valeur(nom, module, reglage)"
            :label="reglage.libelle"
            :hint="reglage.type === 'liste' ? 'Valeurs séparées par des virgules' : (reglage.aide ?? undefined)"
            label-visible
            @update:model-value="saisir(nom, reglage.cle, String($event))"
          />
        </div>

        <DsfrButton
          :label="enregistre === nom ? 'Enregistré' : 'Enregistrer'"
          size="sm"
          data-testid="module-enregistrer"
          @click="enregistrer(nom, module)"
        />
      </template>
    </div>
  </AdminPanel>
</template>
