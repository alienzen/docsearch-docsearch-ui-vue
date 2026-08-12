<script setup lang="ts">
/** Paramètres opérationnels (Redis) — effectifs sous ~10s, sans redémarrage. */
import { ref, watch } from 'vue'
import { getConfig, resetConfig, saveConfigKey } from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useSaveHint } from '@/composables/useSaveHint'
import { useDialogs } from '@/composables/useDialogs'

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
  const ok = await confirm(
    'Charger les paramètres par défaut ? Tout réglage personnalisé sera écrasé.',
    { title: 'Réinitialiser les paramètres', confirmLabel: 'Réinitialiser' },
  )
  if (!ok) return
  actionError.value = null
  try {
    await resetConfig()
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

const { confirm } = useDialogs()

/**
 * Paramètres à deux états, rendus par une liste déroulante plutôt que par
 * un champ libre.
 *
 * Ils sont stockés en CHAÎNE et non en booléen, côté API : set_param()
 * coerce la valeur reçue via `type(DEFAULT_RUNTIME[clé])`, et
 * `bool("false")` vaut `True` en Python — un booléen y serait donc
 * impossible à remettre à faux. La contrepartie est qu'un champ libre
 * accepterait « False », « 0 » ou « oui », qui ne valent rien pour le
 * serveur et échouent en silence. D'où cette liste.
 */
function estBooleen(valeur: unknown): boolean {
  return valeur === 'true' || valeur === 'false'
}

/** Ce qu'un champ ne dit pas de lui-même. */
const AIDES: Record<string, string> = {
  retention_search_logs_days:
    'Durée de conservation du journal des recherches, en jours. Au-delà, ' +
    'les entrées sont supprimées une fois par jour. 0 = conservation ' +
    'illimitée. Les statistiques ne portent que sur la fenêtre conservée.',
  retention_login_events_days:
    'Durée de conservation du journal des connexions, en jours (succès, ' +
    'refus, blocages). 0 = conservation illimitée.',
  retention_audit_log_days:
    'Durée de conservation du journal d’audit des actions ' +
    'd’administration, en jours. C’est la trace qui protège ' +
    'l’administrateur : elle se garde plus longtemps que ce qu’elle trace. ' +
    '0 = conservation illimitée.',
  retention_nps_days:
    'Durée de conservation des réponses NPS, en jours. 0 = conservation illimitée.',
  retention_suggestions_days:
    'Durée de conservation des suggestions déposées par les utilisateurs, ' +
    'en jours. 0 = conservation illimitée.',
  sso_kerberos_enabled:
    'Connexion automatique par ticket Kerberos. Exige un FQDN, un SPN ' +
    'HTTP/<fqdn>, un keytab monté et une stratégie de parc autorisant les ' +
    'navigateurs à envoyer un ticket — sans quoi les postes reçoivent un ' +
    'défi que personne ne peut relever.',
}</script>

<template>
  <AdminPanel
    id="config-panel"
    title="Paramètres opérationnels"
    subtitle="effectifs sous ~10s, sans redémarrage"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError"
      id="config-erreur"
      type="error"
      small
      :description="actionError"
      class="fr-mb-2w"
    />

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="config-tableau">
        <thead>
          <tr>
            <th scope="col">Paramètre</th>
            <th scope="col">Valeur</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(_, key) in data || {}" :key="key" data-testid="config-ligne" :data-cle="key">
            <td>
              <code>{{ key }}</code>
              <span v-if="AIDES[key]" class="fr-hint-text fr-mb-0">{{ AIDES[key] }}</span>
            </td>
            <td>
              <!-- Un paramètre à deux états se règle par une liste : un
                   champ libre accepterait « False » ou « oui », qui ne
                   valent rien pour le serveur et échouent en silence. -->
              <select
                v-if="estBooleen((data || {})[key])"
                v-model="values[key]"
                class="fr-select fr-select--sm"
                :aria-label="`Valeur de ${key}`"
              >
                <option value="true">activé</option>
                <option value="false">désactivé</option>
              </select>
              <!-- Sinon, le type du champ suit celui de la valeur : tous
                   les paramètres n'étaient pas numériques (ocr_languages
                   vaut « fra », ocr_strategy « auto »), et un champ
                   `number` les rendait impossibles à saisir.
                   `step="any"` : sans lui, le pas par défaut vaut 1 et le
                   navigateur invalide toute décimale — or les poids de
                   pertinence (search_boost_*) se règlent finement, un 2.5
                   doit passer. -->
              <input
                v-else
                v-model="values[key]"
                class="fr-input fr-input--sm"
                :type="typeof (data || {})[key] === 'number' ? 'number' : 'text'"
                step="any"
                :aria-label="`Valeur de ${key}`"
              />
            </td>
            <td class="ds-admin__actions">
              <DsfrButton
                size="sm"
                secondary
                label="Enregistrer"
                data-testid="config-enregistrer"
                @click="save(String(key))"
              />
              <span v-if="saved === key" class="fr-hint-text fr-mb-0">✓ enregistré</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DsfrButton
      id="config-defauts"
      class="fr-mt-2w"
      size="sm"
      secondary
      label="Charger les paramètres par défaut"
      @click="reset"
    />
  </AdminPanel>
</template>
