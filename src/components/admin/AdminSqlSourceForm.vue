<script setup lang="ts">
/**
 * Formulaire d'une source SQL — requête et mapping colonne → champ
 * Elasticsearch. Le même formulaire sert à la création et à l'édition.
 *
 * En ÉDITION, le nom et l'index ES sont figés : les changer reviendrait
 * à créer une source distincte plutôt qu'à modifier celle-ci (voir
 * sql_sources_config.add_source côté API).
 */
import { computed, ref } from 'vue'
import {
  createSqlSource,
  isFacetable,
  SQL_ES_TYPES,
  type SqlDsn,
  type SqlField,
  type SqlSource,
} from '@/api/admin'

const props = defineProps<{
  /** Absent en création. */
  name?: string
  source?: SqlSource
  dsns: SqlDsn[]
}>()

const emit = defineEmits<{ saved: []; cancel: [] }>()

const isEdit = computed(() => !!props.source)
const error = ref<string | null>(null)
const busy = ref(false)

function blankField(): SqlField {
  // card_label à null et non '' : une chaîne vide signifie « masquer ce
  // champ », ce qui ne doit pas être le défaut d'une colonne qu'on vient
  // d'ajouter.
  return {
    column: '',
    es_field: '',
    es_type: 'keyword',
    analyzer: '',
    facet: false,
    facet_label: '',
    card_label: null,
  }
}

type FormState = {
  name: string
  db_type: 'postgresql' | 'mysql'
  connection_ref: string
  es_index: string
  id_column: string
  poll_interval_seconds: number | string
  label: string
  description: string
  query: string
  fields: SqlField[]
}

// Copie profonde des champs : on édite un brouillon, la source d'origine
// n'est touchée qu'à l'enregistrement.
const form = ref<FormState>({
  name: props.name || '',
  db_type: props.source?.db_type === 'mysql' ? 'mysql' : 'postgresql',
  connection_ref: props.source?.connection_ref || '',
  es_index: props.source?.es_index || '',
  id_column: props.source?.id_column || 'id',
  poll_interval_seconds: props.source?.poll_interval_seconds || 300,
  label: props.source?.label || '',
  description: props.source?.description || '',
  query: props.source?.query || '',
  fields: props.source?.fields?.length
    ? (JSON.parse(JSON.stringify(props.source.fields)) as SqlField[])
    : [{ column: 'id', es_field: 'id', es_type: 'keyword', facet: false }],
})

/**
 * Un champ qui cesse d'être facettable doit voir sa case décochée, pas
 * seulement grisée : sinon on enverrait `facet: true` sur un type que
 * l'API refuse.
 */
function onTypeChange(field: SqlField) {
  if (!isFacetable(field.es_type)) field.facet = false
}

async function save() {
  const fields = form.value.fields.filter((f) => f.column.trim() && f.es_field.trim())
  const f = form.value
  if (
    !f.name.trim() ||
    !f.connection_ref.trim() ||
    !f.es_index.trim() ||
    !f.id_column.trim() ||
    !f.query.trim() ||
    !fields.length
  ) {
    error.value =
      'Tous les champs sont requis : nom, connection_ref, index ES, colonne ID, requête, et au moins une colonne de mapping.'
    return
  }
  busy.value = true
  error.value = null
  try {
    await createSqlSource({
      name: f.name.trim(),
      db_type: f.db_type,
      connection_ref: f.connection_ref.trim(),
      query: f.query.trim(),
      id_column: f.id_column.trim(),
      es_index: f.es_index.trim(),
      fields: fields.map((x) => ({
        column: x.column.trim(),
        es_field: x.es_field.trim(),
        es_type: x.es_type,
        analyzer: x.analyzer?.trim() || null,
        facet: !!x.facet,
        facet_label: x.facet_label?.trim() || null,
        // Trois états à préserver : champ jamais renseigné (null,
        // « libellé dérivé »), texte, ou chaîne vide explicite
        // (« masquer »). Un `|| null` écraserait le troisième cas.
        card_label: x.card_label === undefined || x.card_label === null
          ? null
          : x.card_label.trim(),
      })),
      poll_interval_seconds: Number(f.poll_interval_seconds) || 300,
      label: f.label.trim() || undefined,
      description: f.description.trim() || undefined,
    })
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div id="sql-formulaire" class="ds-admin__form fr-mt-2w">
    <h4 id="sql-formulaire-titre" class="fr-h6">
      {{ isEdit ? `Modifier « ${name} »` : 'Nouvelle source SQL' }}
    </h4>

    <DsfrAlert
      v-if="error"
      id="sql-erreur"
      type="error"
      small
      :description="error"
      class="fr-mb-2w"
    />

    <div class="ds-admin__row">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label" for="sql-name">Nom</label>
        <input
          id="sql-name"
          v-model="form.name"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="ex : clients_pg"
          :disabled="isEdit"
        />
      </div>
      <div class="fr-select-group fr-mb-0">
        <label class="fr-label" for="sql-dbtype">Type de base</label>
        <select id="sql-dbtype" v-model="form.db_type" class="fr-select fr-select--sm">
          <option value="postgresql">postgresql</option>
          <option value="mysql">mysql</option>
        </select>
      </div>
    </div>

    <div class="ds-admin__row fr-mt-1w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label" for="sql-connref">connection_ref</label>
        <input
          id="sql-connref"
          v-model="form.connection_ref"
          class="fr-input fr-input--sm"
          type="text"
          list="sql-dsn-names"
          placeholder="ex : CLIENTS_PG_DSN"
        />
        <datalist id="sql-dsn-names">
          <option v-for="dsn in dsns" :key="dsn.name" :value="dsn.name" />
        </datalist>
      </div>
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label" for="sql-index">Index ES</label>
        <input
          id="sql-index"
          v-model="form.es_index"
          class="fr-input fr-input--sm"
          type="text"
          placeholder="ex : clients_pg_sql"
          :disabled="isEdit"
        />
      </div>
    </div>

    <div class="ds-admin__row fr-mt-1w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label" for="sql-idcol">Colonne ID</label>
        <input id="sql-idcol" v-model="form.id_column" class="fr-input fr-input--sm" type="text" />
      </div>
      <div class="fr-input-group fr-mb-0 ds-admin__narrow">
        <label class="fr-label" for="sql-interval">Intervalle (s)</label>
        <input
          id="sql-interval"
          v-model="form.poll_interval_seconds"
          class="fr-input fr-input--sm"
          type="number"
          min="10"
        />
      </div>
    </div>

    <div class="ds-admin__row fr-mt-1w">
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label" for="sql-label">Libellé (optionnel)</label>
        <input id="sql-label" v-model="form.label" class="fr-input fr-input--sm" type="text" />
      </div>
      <div class="fr-input-group fr-mb-0">
        <label class="fr-label" for="sql-description">Description (optionnel)</label>
        <input
          id="sql-description"
          v-model="form.description"
          class="fr-input fr-input--sm"
          type="text"
        />
      </div>
    </div>

    <div class="fr-input-group fr-mt-1w">
      <label class="fr-label" for="sql-query">Requête</label>
      <textarea
        id="sql-query"
        v-model="form.query"
        class="fr-input ds-admin__query"
        rows="3"
        placeholder="SELECT id, nom, email FROM clients WHERE actif = true"
      />
    </div>

    <h5 id="sql-colonnes-titre" class="fr-h6 fr-mt-2w">Mapping colonnes → champs Elasticsearch</h5>
    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="sql-colonnes-tableau">
        <thead>
          <tr>
            <th scope="col">Colonne SQL</th>
            <th scope="col">Champ ES</th>
            <th scope="col">Type ES</th>
            <th scope="col">Analyseur</th>
            <th scope="col">Facette</th>
            <th scope="col">Libellé facette</th>
            <th scope="col">Libellé carte</th>
            <th scope="col"><span class="fr-sr-only">Retirer</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(field, i) in form.fields" :key="i" data-testid="sql-colonne">
            <td>
              <input
                v-model="field.column"
                class="fr-input fr-input--sm"
                type="text"
                placeholder="colonne SQL"
                :aria-label="`Colonne SQL ligne ${i + 1}`"
              />
            </td>
            <td>
              <input
                v-model="field.es_field"
                class="fr-input fr-input--sm"
                type="text"
                placeholder="champ ES"
                :aria-label="`Champ ES ligne ${i + 1}`"
              />
            </td>
            <td>
              <select
                v-model="field.es_type"
                class="fr-select fr-select--sm"
                :aria-label="`Type ES ligne ${i + 1}`"
                @change="onTypeChange(field)"
              >
                <option v-for="type in SQL_ES_TYPES" :key="type" :value="type">{{ type }}</option>
              </select>
            </td>
            <td>
              <input
                v-model="field.analyzer"
                class="fr-input fr-input--sm"
                type="text"
                placeholder="ex : french"
                :aria-label="`Analyseur ligne ${i + 1}`"
              />
            </td>
            <td>
              <div class="fr-checkbox-group fr-checkbox-group--sm">
                <input
                  :id="`sql-facet-${i}`"
                  v-model="field.facet"
                  type="checkbox"
                  :disabled="!isFacetable(field.es_type)"
                />
                <label class="fr-label" :for="`sql-facet-${i}`">
                  <span class="fr-sr-only">Afficher comme facette</span>
                </label>
              </div>
            </td>
            <td>
              <input
                v-model="field.facet_label"
                class="fr-input fr-input--sm"
                type="text"
                placeholder="ex : Bureau"
                :aria-label="`Libellé de facette ligne ${i + 1}`"
              />
            </td>
            <td>
              <input
                v-model="field.card_label"
                class="fr-input fr-input--sm"
                type="text"
                placeholder="vide = auto"
                :aria-label="`Libellé de carte ligne ${i + 1}`"
              />
            </td>
            <td>
              <DsfrButton
                size="sm"
                tertiary
                no-outline
                label="✕"
                data-testid="sql-colonne-retirer"
                title="Retirer cette colonne"
                @click="form.fields.splice(i, 1)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <DsfrButton
      id="sql-colonne-ajouter"
      class="fr-mt-1w"
      size="sm"
      secondary
      label="+ Ajouter une colonne"
      @click="form.fields.push(blankField())"
    />

    <p class="fr-hint-text fr-mt-2w">
      <code>connection_ref</code> est le NOM d'une variable d'environnement contenant le DSN complet,
      OU le nom d'un DSN chiffré enregistré plus bas — la variable d'environnement reste toujours
      prioritaire si elle existe. « Analyseur » n'a de sens que pour le type <code>text</code>
      (ex. <code>french</code>). « Facette » ajoute une section de filtre dans la recherche dès que
      cette source est interrogée, et n'est possible que pour les types <code>keyword</code> et
      <code>boolean</code>.
    </p>

    <div class="ds-admin__row fr-mt-1w">
      <DsfrButton id="sql-enregistrer" size="sm" label="Enregistrer" :disabled="busy" @click="save" />
      <DsfrButton id="sql-annuler" size="sm" secondary label="Annuler" @click="emit('cancel')" />
    </div>
  </div>
</template>
