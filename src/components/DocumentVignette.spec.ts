import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentVignette from './DocumentVignette.vue'

const IMAGE = 'https://intranet.exemple.fr/img/une.jpg'

describe('DocumentVignette', () => {
  it('rend l’image quand la source en fournit une', () => {
    const w = mount(DocumentVignette, { props: { url: IMAGE } })

    expect(w.find('img').attributes('src')).toBe(IMAGE)
  })

  it('ne rend rien du tout sans image', () => {
    // Le cas ordinaire : la plupart des documents n'en ont pas, et une
    // balise vide laisserait le fond gris de la vignette sur la carte.
    expect(mount(DocumentVignette, { props: {} }).find('img').exists()).toBe(false)
    expect(mount(DocumentVignette, { props: { url: '' } }).find('img').exists()).toBe(false)
  })

  it('n’accepte que http et https', () => {
    // Même liste blanche que le lien de la carte, et pour la même
    // raison : l'adresse est écrite par un module tiers, et le `:src` de
    // Vue n'assainit rien.
    // eslint-disable-next-line no-script-url -- valeur éprouvée par ce test
    expect(mount(DocumentVignette, { props: { url: 'javascript:alert(1)' } }).find('img').exists()).toBe(
      false,
    )
    expect(
      mount(DocumentVignette, { props: { url: 'data:image/png;base64,iVBORw0K' } }).find('img').exists(),
    ).toBe(false)
  })

  it('retire l’image qui ne répond pas', async () => {
    // Attendu, pas exceptionnel : le module n'a jamais vérifié que
    // l'adresse existe, et un article survit au retrait de son
    // illustration. Un cadre brisé au milieu de la carte est pire que
    // pas d'image.
    const w = mount(DocumentVignette, { props: { url: IMAGE } })
    await w.find('img').trigger('error')

    expect(w.find('img').exists()).toBe(false)
  })

  it('redonne sa chance à l’image suivante', async () => {
    // Une carte de résultat est réutilisée d'une recherche à l'autre :
    // sans remise à zéro, une vignette cassée masquerait celle du
    // document affiché ensuite au même endroit.
    const w = mount(DocumentVignette, { props: { url: IMAGE } })
    await w.find('img').trigger('error')
    await w.setProps({ url: 'https://intranet.exemple.fr/img/autre.png' })

    expect(w.find('img').attributes('src')).toBe('https://intranet.exemple.fr/img/autre.png')
  })

  it('reste décorative et discrète', () => {
    const img = mount(DocumentVignette, { props: { url: IMAGE } }).find('img')

    // `alt` vide : le titre de l'article précède l'image et porte déjà
    // l'information — la répéter la ferait entendre deux fois.
    expect(img.attributes('alt')).toBe('')
    // Une liste de résultats peut porter vingt vignettes : elles ne se
    // téléchargent qu'à l'approche de l'écran.
    expect(img.attributes('loading')).toBe('lazy')
    // Le serveur d'images n'a pas à apprendre depuis quelle page on la
    // demande.
    expect(img.attributes('referrerpolicy')).toBe('no-referrer')
  })

  it('recadre sur la carte, montre l’image entière dans la fiche', () => {
    // Deux formats, deux règles CSS : la carte impose ses dimensions pour
    // que la liste ne saute pas, la fiche montre ce qu'on est venu voir.
    const carte = mount(DocumentVignette, { props: { url: IMAGE, format: 'carte' } })
    const detail = mount(DocumentVignette, { props: { url: IMAGE, format: 'detail' } })

    expect(carte.find('img').classes()).toContain('ds-vignette--carte')
    expect(detail.find('img').classes()).toContain('ds-vignette--detail')
  })
})
