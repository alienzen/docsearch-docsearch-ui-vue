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
import { normalizeScheme, useUiConfigStore, type UiConfig } from '@/stores/uiConfig'
import { useSaveHint } from '@/composables/useSaveHint'

const uiConfig = useUiConfigStore()
const { saved, flash } = useSaveHint()
const error = ref<string | null>(null)

const TOGGLES: { key: keyof UiConfig; label: string }[] = [
  { key: 'chat_enabled', label: 'Lien « Assistant IA » dans l’en-tête de recherche' },
  { key: 'footer_enabled', label: 'Pied de page des pages « recherche »' },
  {
    key: 'footer_enabled_admin',
    label: 'Pied de page des pages « administration » (celle-ci, statistiques, aide admin)',
  },
  {
    key: 'admin_links_enabled',
    label: 'Liens « Administration » / « Statistiques » (même pour les utilisateurs autorisés)',
  },
  { key: 'export_enabled', label: 'Export des résultats de recherche (XLSX / DOCX)' },
  { key: 'help_enabled', label: 'Lien « Aide »' },
  { key: 'collections_enabled', label: '« Mes collections »' },
  { key: 'custom_keywords_enabled', label: 'Mots-clés personnalisés sur les documents' },
  { key: 'alerts_enabled', label: 'Alertes sur les recherches enregistrées' },
  { key: 'sort_enabled', label: 'Sélecteur de tri des résultats' },
  { key: 'show_current_user_enabled', label: 'Badge « Connecté : … » côté recherche' },
  { key: 'show_current_user_groups_enabled', label: '… avec ses groupes' },
  { key: 'show_current_user_enabled_admin', label: 'Badge « Connecté : … » côté administration' },
  { key: 'show_current_user_groups_enabled_admin', label: '… avec ses groupes' },
]

const TEXT_FIELDS: {
  key: keyof UiConfig
  label: string
  hint?: string
  /** Rendu en zone de saisie multiligne plutôt qu'en champ d'une ligne. */
  multiline?: boolean
}[] = [
  {
    key: 'logo_text',
    label: 'Texte du bloc-marque',
    hint: "Bloc « République Française » de l'en-tête et du pied de page. Une ligne de saisie = une ligne affichée.",
    multiline: true,
  },
  { key: 'header_logo_text', label: 'Titre (en-tête)' },
  { key: 'header_subtitle_text', label: 'Sous-titre (en-tête)' },
  { key: 'favicon_url', label: 'Favicon personnalisé' },
  { key: 'footer_text', label: 'Description (pied de page)' },
  {
    key: 'footer_bottom_text',
    label: 'Mention de bas de page',
    hint: 'Ligne tout en bas du pied de page. Vide = ligne masquée.',
    multiline: true,
  },
  {
    key: 'sources_mount_display',
    label: 'Chemin affiché (bouton « Copier le chemin »)',
    hint: 'Ex. \\\\serveur\\partage — remplace le chemin interne aux conteneurs pour que le chemin copié soit utilisable.',
  },
]

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
    TEXT_FIELDS.map((f) => [f.key, String(uiConfig.config[f.key] ?? '')]),
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
    <DsfrAlert v-if="error" type="error" small :description="error" class="fr-mb-2w" />

    <div class="fr-fieldset__content">
      <div v-for="toggle in TOGGLES" :key="toggle.key" class="fr-checkbox-group">
        <input
          :id="`ui-${toggle.key}`"
          type="checkbox"
          :checked="!!uiConfig.config[toggle.key]"
          @change="saveKey(String(toggle.key), ($event.target as HTMLInputElement).checked)"
        />
        <label class="fr-label" :for="`ui-${toggle.key}`">{{ toggle.label }}</label>
      </div>
    </div>

    <h3 class="fr-h6 fr-mt-3w">Apparence</h3>
    <p class="fr-hint-text">
      L'interface suit le Système de Design de l'État. Seul le mode clair ou sombre est réglable ;
      les anciens thèmes de couleur ont été retirés.
    </p>
    <div class="ds-admin__row">
      <DsfrSelect
        v-model="searchScheme"
        label="Thème — Recherche"
        label-visible
        :options="SCHEMES"
      />
      <DsfrSelect
        v-model="adminScheme"
        label="Thème — Administration"
        label-visible
        :options="SCHEMES"
      />
    </div>

    <h3 class="fr-h6 fr-mt-3w">Personnalisation</h3>
    <div v-for="field in TEXT_FIELDS" :key="field.key" class="ds-admin__row fr-mt-1w">
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
        @click="saveKey(String(field.key), texts[field.key])"
      />
      <span v-if="saved === field.key" class="fr-hint-text fr-mb-0">✓ enregistré</span>
    </div>
  </AdminPanel>
</template>
