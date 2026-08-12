<script setup lang="ts">
/**
 * Résultats épinglés — sur les quelques requêtes que tout le monde tape
 * (« congés », « note de frais »), le bon document est connu d'avance.
 *
 * Deux choses que ce panneau doit rendre évidentes, parce qu'elles ne se
 * devinent pas :
 *
 * 1. **Épingler met en avant, ça n'autorise pas.** Le document reste
 *    filtré par les droits de chaque utilisateur ; celui qui n'y a pas
 *    accès ne le voit pas, épinglé ou non.
 * 2. **Un identifiant peut devenir orphelin.** Un document supprimé de
 *    l'index laisse une règle qui ne fait plus rien — invisible côté
 *    recherche, puisque la relecture le filtre. C'est ici, et seulement
 *    ici, qu'on peut s'en apercevoir : la ligne est signalée.
 *
 * L'identifiant d'un document se récupère depuis sa fiche détail
 * (l'adresse `/document/{id}` de l'API).
 */
import { ref } from 'vue'
import { getPinned, setPinned, type ReglePinned } from '@/api/admin'
import { useStatsPanel } from '@/composables/useStatsPanel'
import { useDialogs } from '@/composables/useDialogs'

const { data, error, refresh } = useStatsPanel(getPinned)
const { confirm } = useDialogs()

const requete = ref('')
const identifiants = ref('')
const actionError = ref<string | null>(null)

/** Un identifiant par ligne ou séparés par des virgules — au choix. */
function decouper(texte: string): string[] {
  return texte
    .split(/[\n,]/)
    .map((valeur) => valeur.trim())
    .filter(Boolean)
}

async function enregistrer() {
  actionError.value = null
  try {
    await setPinned(requete.value, decouper(identifiants.value))
    requete.value = ''
    identifiants.value = ''
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

async function retirer(regle: ReglePinned) {
  const ok = await confirm(`Retirer les documents épinglés sur « ${regle.requete} » ?`, {
    title: 'Retirer l’épinglage',
    confirmLabel: 'Retirer',
  })
  if (!ok) return
  actionError.value = null
  try {
    await setPinned(regle.requete, [])
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e)
  }
}

function modifier(regle: ReglePinned) {
  requete.value = regle.requete
  identifiants.value = regle.documents.map((d) => d.id).join('\n')
}
</script>

<template>
  <AdminPanel
    id="pinned-panel"
    title="Résultats épinglés"
    subtitle="documents mis en avant sur une requête précise"
    :error="error"
  >
    <DsfrAlert
      v-if="actionError"
      id="epingles-erreur"
      type="error"
      small
      :description="actionError"
      class="fr-mb-2w"
    />

    <p class="fr-hint-text">
      Les documents épinglés s'affichent en tête de la première page, sous la mention
      « Proposé par votre administration ». Ils restent soumis aux droits de chaque
      utilisateur : épingler met en avant, cela n'autorise pas. La requête est comparée
      sans tenir compte de la casse ni des accents.
    </p>

    <div class="fr-mb-2w">
      <DsfrInput
        id="epingles-requete"
        v-model="requete"
        label="Requête"
        label-visible
        hint="Par exemple : congés"
      />
      <DsfrInput
        id="epingles-documents"
        v-model="identifiants"
        label="Identifiants des documents"
        label-visible
        hint="Un par ligne, du plus important au moins important (5 au maximum)."
        is-textarea
      />
      <DsfrButton
        id="epingles-enregistrer"
        size="sm"
        label="Enregistrer"
        class="fr-mt-1w"
        :disabled="!requete.trim()"
        @click="enregistrer"
      />
    </div>

    <div class="fr-table fr-table--bordered ds-stats__table">
      <table id="epingles-tableau">
        <thead>
          <tr>
            <th scope="col">Requête</th>
            <th scope="col">Documents</th>
            <th scope="col"><span class="fr-sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!(data?.regles || []).length">
            <td colspan="3" class="fr-hint-text">
              Aucun épinglage. Les requêtes les plus fréquentes de la page Statistiques
              sont le meilleur endroit où commencer.
            </td>
          </tr>
          <tr
            v-for="regle in data?.regles || []"
            :key="regle.requete"
            data-testid="epingle-ligne"
            :data-requete="regle.requete"
          >
            <td><code>{{ regle.requete }}</code></td>
            <td>
              <ul class="fr-mb-0">
                <li v-for="document in regle.documents" :key="document.id">
                  <template v-if="document.trouve">
                    {{ document.title || document.filename || document.id }}
                    <span class="fr-hint-text">{{ document.filepath }}</span>
                  </template>
                  <!-- Sans ce signalement, on épingle durablement un lien
                       mort que personne ne voit disparaître. -->
                  <span v-else class="fr-badge fr-badge--sm fr-badge--warning">
                    introuvable — {{ document.id }}
                  </span>
                </li>
              </ul>
            </td>
            <td class="ds-admin__actions">
              <DsfrButton
                size="sm"
                secondary
                label="Modifier"
                data-testid="epingle-modifier"
                @click="modifier(regle)"
              />
              <DsfrButton
                size="sm"
                secondary
                label="Retirer"
                data-testid="epingle-retirer"
                @click="retirer(regle)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminPanel>
</template>
