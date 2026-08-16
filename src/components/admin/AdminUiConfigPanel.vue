<script setup lang="ts">
/**
 * Bascules et personnalisation de l'interface.
 *
 * Lecture via l'endpoint public /ui-config (le /admin/ homonyme est en
 * écriture seule), écriture via /admin/ui-config, une clé à la fois.
 *
 * Les deux sélecteurs de thème ne proposent plus que Clair / Sombre /
 * Système : les 7 thèmes maison de docsearch-ui (Ardoise, Rouge, Vert,
 * Contraste élevé…) n'ont plus lieu d'être maintenant que l'apparence
 * est celle du Système de Design de l'État. Une valeur héritée encore
 * stockée en base s'affiche comme « Système » (voir normalizeScheme) et
 * sera écrasée au premier enregistrement.
 */
import { computed, onMounted, ref } from 'vue'
import { saveUiConfig } from '@/api/admin'
import { normalizeScheme, useUiConfigStore } from '@/stores/uiConfig'
import { useSaveHint } from '@/composables/useSaveHint'
// Libellés sortis du composant pour être indexables par le sommaire —
// voir l'en-tête de champs.ts.
import { BASCULES_UI, CHAMPS_TEXTE_UI } from './champs'

const uiConfig = useUiConfigStore()
const { saved, flash } = useSaveHint()
const error = ref<string | null>(null)

const SCHEMES = [
  { value: 'system', text: 'Système (préférence du poste)' },
  { value: 'light', text: 'Clair' },
  { value: 'dark', text: 'Sombre' },
]

/** Copie éditable des champs texte : on n'enregistre qu'au bouton. */
const texts = ref<Record<string, string>>({})

const searchScheme = computed({
  get: () => normalizeScheme(uiConfig.config.theme),
  set: (value) => saveKey('theme', value),
})
const adminScheme = computed({
  get: () => normalizeScheme(uiConfig.config.theme_admin),
  set: (value) => saveKey('theme_admin', value),
})

async function saveKey(key: string, value: unknown) {
  const before = (uiConfig.config as Record<string, unknown>)[key]
  ;(uiConfig.config as Record<string, unknown>)[key] = value
  error.value = null
  try {
    await saveUiConfig({ [key]: value })
    flash(key)
    // Le thème doit s'appliquer immédiatement à CETTE page quand c'est
    // celui de l'administration qui vient de changer.
    if (key === 'theme_admin') uiConfig.applyScheme('admin')
  } catch (e) {
    ;(uiConfig.config as Record<string, unknown>)[key] = before
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(async () => {
  await uiConfig.loadUiConfig()
  texts.value = Object.fromEntries(
    CHAMPS_TEXTE_UI.map((f) => [f.key, String(uiConfig.config[f.key] ?? '')]),
  )
  uiConfig.applyScheme('admin')
})
</script>

<template>
  <AdminPanel
    id="ui-config-panel"
    title="Interface"
    subtitle="effectif immédiatement, pas de redémarrage"
  >
    <DsfrAlert
      v-if="error"
      id="ui-config-erreur"
      type="error"
      small
      :description="error"
      class="fr-mb-2w"
    />

    <div id="ui-config-bascules" class="fr-fieldset__content">
      <div v-for="toggle in BASCULES_UI" :key="toggle.key" class="fr-checkbox-group">
        <input
          :id="`ui-${toggle.key}`"
          data-testid="ui-config-bascule"
          type="checkbox"
          :checked="!!uiConfig.config[toggle.key]"
          @change="saveKey(String(toggle.key), ($event.target as HTMLInputElement).checked)"
        />
        <label class="fr-label" :for="`ui-${toggle.key}`">{{ toggle.label }}</label>
      </div>
    </div>

    <h3 id="ui-config-apparence-titre" class="fr-h6 fr-mt-3w">Apparence</h3>
    <p class="fr-hint-text">
      L'interface suit le Système de Design de l'État. Seul le mode clair ou sombre est réglable ;
      les anciens thèmes de couleur ont été retirés.
    </p>
    <div class="ds-admin__row">
      <DsfrSelect
        v-model="searchScheme"
        select-id="ui-config-theme-recherche"
        label="Thème — Recherche"
        label-visible
        :options="SCHEMES"
      />
      <DsfrSelect
        v-model="adminScheme"
        select-id="ui-config-theme-admin"
        label="Thème — Administration"
        label-visible
        :options="SCHEMES"
      />
    </div>

    <h3 id="ui-config-textes-titre" class="fr-h6 fr-mt-3w">Personnalisation</h3>
    <div
      v-for="field in CHAMPS_TEXTE_UI"
      :key="field.key"
      class="ds-admin__row fr-mt-1w"
      data-testid="ui-config-texte"
      :data-cle="field.key"
    >
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label" :for="`ui-${field.key}`">
          {{ field.label }}
          <span v-if="field.hint" class="fr-hint-text">{{ field.hint }}</span>
        </label>
        <textarea
          v-if="field.multiline"
          :id="`ui-${field.key}`"
          v-model="texts[field.key]"
          class="fr-input fr-input--sm"
          rows="3"
        />
        <input
          v-else
          :id="`ui-${field.key}`"
          v-model="texts[field.key]"
          class="fr-input fr-input--sm"
          type="text"
        />
      </div>
      <DsfrButton
        size="sm"
        secondary
        label="Enregistrer"
        data-testid="ui-config-enregistrer"
        @click="saveKey(String(field.key), texts[field.key])"
      />
      <span v-if="saved === field.key" class="fr-hint-text fr-mb-0">✓ enregistré</span>
    </div>
  </AdminPanel>
</template>
