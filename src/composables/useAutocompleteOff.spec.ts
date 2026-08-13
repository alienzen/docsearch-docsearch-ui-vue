import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useAutocompleteOff } from './useAutocompleteOff'

/**
 * L'en-tête du DSFR porte deux barres de recherche : celle de bureau,
 * présente dès le montage, et celle du modal mobile, que `DsfrHeader`
 * ne rend qu'à l'ouverture du modal. C'est cette seconde barre qui
 * justifie l'observateur — une passe unique au montage la manquerait —
 * et c'est donc elle que ces tests éprouvent.
 *
 * Le vrai `DsfrHeader` n'est pas utilisable ici : son modal active un
 * piège à focus qui lève une exception sous jsdom, faute d'élément
 * « tabbable » mesurable. On reproduit donc le seul balisage dont le
 * composable dépend, `header.fr-header` et `.fr-search-bar`.
 */
function barre(id: string) {
  const form = document.createElement('form')
  form.className = 'fr-search-bar'
  const input = document.createElement('input')
  input.type = 'search'
  input.id = id
  form.append(input)
  return form
}

const Hote = defineComponent({
  setup() {
    useAutocompleteOff()
    return () => h('div')
  },
})

function monterAvecEntete() {
  document.body.innerHTML = ''
  const header = document.createElement('header')
  header.className = 'fr-header'
  header.append(barre('recherche'))
  document.body.append(header)
  return { header, wrapper: mount(Hote, { attachTo: document.body }) }
}

const autocompleteDe = (id: string) => document.getElementById(id)?.getAttribute('autocomplete')

describe('useAutocompleteOff', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('coupe la barre déjà présente au montage', () => {
    monterAvecEntete()
    expect(autocompleteDe('recherche')).toBe('off')
  })

  it('coupe une barre apparue après le montage', async () => {
    const { header } = monterAvecEntete()
    header.append(barre('recherche-mobile'))
    // Les rappels d'un MutationObserver sont livrés en microtâche.
    await nextTick()
    expect(autocompleteDe('recherche-mobile')).toBe('off')
  })

  it('n’observe plus rien une fois la page démontée', async () => {
    const { header, wrapper } = monterAvecEntete()
    wrapper.unmount()
    header.append(barre('recherche-tardive'))
    await nextTick()
    expect(autocompleteDe('recherche-tardive')).toBeNull()
  })

  it('ne casse pas sur une page sans en-tête', () => {
    document.body.innerHTML = ''
    expect(() => mount(Hote, { attachTo: document.body }).unmount()).not.toThrow()
  })
})
