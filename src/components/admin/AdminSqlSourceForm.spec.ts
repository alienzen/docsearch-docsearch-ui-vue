import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminSqlSourceForm from './AdminSqlSourceForm.vue'
import { createSqlSource } from '@/api/admin'

// Le mapping colonne → champ ES est la seule partie du formulaire dont
// une saisie pouvait disparaître SANS RIEN DIRE : une ligne à moitié
// remplie était filtrée avant l'envoi, l'API répondait 200, le
// formulaire se fermait, et l'utilisateur n'avait ni erreur ni
// confirmation — seulement sa colonne évaporée. C'est ce silence que
// ces tests verrouillent.

vi.mock('@/api/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/admin')>()),
  createSqlSource: vi.fn(() => Promise.resolve({})),
}))

const SOURCE = {
  db_type: 'postgresql' as const,
  connection_ref: 'CLIENTS_PG_DSN',
  query: 'SELECT id, nom FROM clients',
  id_column: 'id',
  es_index: 'clients_sql',
  poll_interval_seconds: 300,
  fields: [
    { column: 'id', es_field: 'id', es_type: 'keyword' as const },
    { column: 'nom', es_field: 'nom', es_type: 'text' as const },
  ],
}

function monter() {
  return mount(AdminSqlSourceForm, {
    props: { name: 'clients', source: structuredClone(SOURCE), dsns: [] },
  })
}

/** Les lignes du mapping, dans l'ordre du tableau. */
function lignes(wrapper: ReturnType<typeof monter>) {
  return wrapper.findAll('[data-testid="sql-colonne"]')
}

async function enregistrer(wrapper: ReturnType<typeof monter>) {
  await wrapper.get('#sql-enregistrer').trigger('click')
  await flushPromises()
}

describe('AdminSqlSourceForm — mapping colonnes', () => {
  beforeEach(() => {
    vi.mocked(createSqlSource).mockClear()
  })

  it('refuse une ligne dont seule la colonne SQL est remplie, en la désignant', async () => {
    const wrapper = monter()
    await wrapper.get('#sql-colonne-ajouter').trigger('click')
    await lignes(wrapper)[2].findAll('input')[0].setValue('telephone')

    await enregistrer(wrapper)

    expect(createSqlSource).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Mapping, ligne 3')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('refuse aussi la moitié inverse — champ ES sans colonne SQL', async () => {
    const wrapper = monter()
    await wrapper.get('#sql-colonne-ajouter').trigger('click')
    await lignes(wrapper)[2].findAll('input')[1].setValue('telephone')

    await enregistrer(wrapper)

    expect(createSqlSource).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Mapping, ligne 3')
  })

  it('tolère une ligne entièrement vide : rien n’y a été saisi, rien n’est perdu', async () => {
    const wrapper = monter()
    await wrapper.get('#sql-colonne-ajouter').trigger('click')

    await enregistrer(wrapper)

    expect(createSqlSource).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createSqlSource).mock.calls[0][0].fields).toHaveLength(2)
  })

  it('envoie la ligne ajoutée et annonce la source enregistrée', async () => {
    const wrapper = monter()
    await wrapper.get('#sql-colonne-ajouter').trigger('click')
    const inputs = lignes(wrapper)[2].findAll('input')
    await inputs[0].setValue('telephone')
    await inputs[1].setValue('tel')

    await enregistrer(wrapper)

    const envoye = vi.mocked(createSqlSource).mock.calls[0][0]
    expect(envoye.fields.map((f) => f.column)).toEqual(['id', 'nom', 'telephone'])
    // Le nom part avec l'événement : c'est lui que le panneau affiche
    // dans sa confirmation, le formulaire étant démonté juste après.
    expect(wrapper.emitted('saved')).toEqual([['clients']])
  })
})
