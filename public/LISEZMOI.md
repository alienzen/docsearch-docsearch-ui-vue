# Images de marque de l'installation

Ces fichiers sont référençables par le réglage « Favicon personnalisé »
du panneau d'administration, qui ne stocke qu'un NOM DE FICHIER
(ex. `Bloc_Marianne.svg`) résolu relativement à la racine du site. Ils
doivent donc être servis par ce conteneur, comme ils l'étaient par
docsearch-ui.

Le réglage « Logo personnalisé (en-tête) » a été retiré à la migration :
l'en-tête DSFR porte le bloc-marque « République Française », auquel un
second logo libre se substituait mal. Les fichiers de logo restent ici,
utilisables comme favicon.

Repris tels quels de docsearch-ui/public/ lors de la migration : sans
eux, les réglages existants pointent vers des fichiers absents et
l'en-tête comme l'onglet retombent sur les valeurs par défaut.

Pour utiliser une autre image : la déposer ici, puis saisir son nom dans
le champ « Favicon personnalisé » du panneau « Interface ».

## `logo-docsearch.svg` fait exception

C'est la marque du LOGICIEL, pas de l'installation : elle n'est donc pas
paramétrable et aucun réglage ne la désigne. Les six pages la citent en
dur (`operator-img-src="/logo-docsearch.svg"`).

Elle ne rouvre pas le réglage « Logo personnalisé (en-tête) » retiré
ci-dessus : celui-ci se substituait au bloc-marque, alors que celle-ci
occupe `.fr-header__operator`, l'emplacement que le DSFR prévoit à côté
du bloc-marque et de son filet vertical.

Servie depuis `public/` et non importée depuis `src/assets` : un asset
importé devient un module commun aux six entrées, et Rollup en fait
alors le nom du gros paquet partagé — la feuille DSFR d'un Mio se
retrouve appelée `logo-docsearch-*.css`.
