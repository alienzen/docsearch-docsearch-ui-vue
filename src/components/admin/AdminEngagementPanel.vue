<script setup lang="ts">
/**
 * Mesure de satisfaction : suspend individuellement le pouce, le NPS et
 * le lien « Suggérer une idée ».
 *
 * Le tracking de clic sur les résultats n'a volontairement pas de
 * bascule : signal passif, sans widget ni friction pour l'utilisateur.
 *
 * Lecture via l'endpoint public /engagement-config (le /admin/ homonyme
 * est en écriture seule), écriture via /admin/engagement-config.
 */
import { onMounted, ref } from 'vue'
import { saveEngagementConfig } from '@/api/admin'
import { useUiConfigStore } from '@/stores/uiConfig'
// Libellés sortis du composant pour être indexables par le sommaire —
// voir l'en-tête de champs.ts.
import { BASCULES_ENGAGEMENT, type CleEngagement } from './champs'

const uiConfig = useUiConfigStore()
const error = ref<string | null>(null)

async function update(key: CleEngagement, checked: boolean) {
  const before = uiConfig.engagement[key]
  uiConfig.engagement[key] = checked
  error.value = null
  try {
    await saveEngagementConfig({ [key]: checked })
  } catch (e) {
    // Remet la case dans son état d'avant : afficher « activé » alors
    // que l'enregistrement a échoué serait un mensonge.
    uiConfig.engagement[key] = before
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(() => uiConfig.loadEngagementConfig())
</script>

<template>
  <AdminPanel
    id="engagement-panel"
    title="Mesure de satisfaction"
    subtitle="effectif immédiatement, pas de redémarrage"
  >
    <DsfrAlert
      v-if="error"
      id="engagement-erreur"
      type="error"
      small
      :description="error"
      class="fr-mb-2w"
    />

    <div id="engagement-bascules" class="fr-fieldset__content">
      <div v-for="toggle in BASCULES_ENGAGEMENT" :key="toggle.key" class="fr-checkbox-group">
        <input
          :id="`eng-${toggle.key}`"
          data-testid="engagement-bascule"
          type="checkbox"
          :checked="uiConfig.engagement[toggle.key]"
          @change="update(toggle.key, ($event.target as HTMLInputElement).checked)"
        />
        <label class="fr-label" :for="`eng-${toggle.key}`">{{ toggle.label }}</label>
      </div>
    </div>

    <p class="fr-hint-text fr-mt-2w">
      Le tracking de clic sur les résultats reste toujours actif — c'est un signal passif, sans
      widget ni friction pour l'utilisateur, aucune bascule n'est nécessaire.
    </p>
  </AdminPanel>
</template>
