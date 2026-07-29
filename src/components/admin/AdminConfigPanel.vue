<script setup lang="ts">
/** Paramètres opérationnels (Redis) — effectifs sous ~10s, sans redémarrage. */
import { ref, watch } from 'vue'
import { getConfig, resetConfig, saveConfigKey } from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useSaveHint } from '@/composables/useSaveHint'

const { data, error, refresh } = useStatsPanel(getConfig)
const { saved, flash } = useSaveHint()
const actionError = ref<string | null>(null)

/** Copie éditable : on ne modifie la valeur distante qu'à l'enregistrement. */
const values = ref<Record<string, string>>({})
watch(data, (cfg) => {
  if (cfg) values.value = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v)]))
})

async function save(key: string) {
  actionError.value = null
  try {
    await saveConfigKey(key, values.value[key])
    flash(key)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function reset() {
  if (!confirm('Charger les paramètres par défaut ? Tout réglage personnalisé sera écrasé.')) return
  actionError.value = null
  try {
    await resetConfig()
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AdminPanel
    id="config-panel"
    title="Paramètres opérationnels"
    subtitle="effectifs sous ~10s, sans redémarrage"
    :error="error"
  >
    <DsfrAlert v-if="actionError" type="error" small :description="actionError" class="fr-mb-2w" />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table>
        <thead>
          <tr>
            <th scope="col">Paramètre</th>
            <th scope="col">Valeur</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(_, key) in data || {}" :key="key">
            <td><code>{{ key }}</code></td>
            <td>
              <input
                v-model="values[key]"
                class="fr-input fr-input--sm"
                type="number"
                :aria-label="`Valeur de ${key}`"
              />
            </td>
            <td class="ds-admin__actions">
              <DsfrButton size="sm" secondary label="Enregistrer" @click="save(String(key))" />
              <span v-if="saved === key" class="fr-hint-text fr-mb-0">✓ enregistré</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DsfrButton
      class="fr-mt-2w"
      size="sm"
      secondary
      label="Charger les paramètres par défaut"
      @click="reset"
    />
  </AdminPanel>
</template>
