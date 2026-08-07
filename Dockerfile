# ── docsearch-ui-vue — Interface web Vue 3 + DSFR ─────────────
# Deux étapes : compilation du bundle avec Vite, puis une image Nginx
# qui ne contient que le résultat (aucun node_modules en production).
#
# Nginx sert les pages construites ET proxifie /search, /document,
# /ask... vers docsearch-api, comme le fait docsearch-ui — l'interface
# fonctionne donc seule, sans dépendre du reverse proxy de production.

# Images de base pleinement qualifiées (docker.io/library/...) : voir
# docsearch-api/Dockerfile pour la raison (podman + machines isolées).
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
# package*.json d'abord : cette couche (l'installation, la plus longue)
# n'est refaite que si les dépendances changent, pas à chaque édition
# de source.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# ── Identité de la livraison ──────────────────────────────────
# Contrairement à l'API et à l'ingestion, la version n'est pas lue à
# l'exécution : il n'y a pas d'exécution côté interface, seulement des
# fichiers statiques servis par Nginx. Vite fige donc les trois valeurs
# DANS le bundle au moment du build (voir vite.config.ts, bloc `define`).
#
# L'interface rapporte ainsi SA PROPRE version, jamais celle de l'API.
# C'est délibéré : un conteneur ui-vue oublié lors d'une mise à jour est
# exactement le cas que cet affichage doit rendre visible — s'il
# affichait la version de l'API, il mentirait précisément quand on a
# besoin de lui.
ARG DOCSEARCH_VERSION=inconnu
ARG DOCSEARCH_COMMIT=inconnu
ARG DOCSEARCH_BUILD_DATE=inconnu
ENV DOCSEARCH_VERSION=${DOCSEARCH_VERSION} \
    DOCSEARCH_COMMIT=${DOCSEARCH_COMMIT} \
    DOCSEARCH_BUILD_DATE=${DOCSEARCH_BUILD_DATE}
RUN npm run build

FROM docker.io/library/nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Répétés sur l'image FINALE : les ARG/LABEL de l'étape de construction
# ne survivent pas au changement de FROM, et c'est l'image finale que
# `podman inspect` interroge sur les serveurs.
ARG DOCSEARCH_VERSION=inconnu
ARG DOCSEARCH_COMMIT=inconnu
ARG DOCSEARCH_BUILD_DATE=inconnu
LABEL org.opencontainers.image.title="docsearch-ui-vue" \
      org.opencontainers.image.version=${DOCSEARCH_VERSION} \
      org.opencontainers.image.revision=${DOCSEARCH_COMMIT} \
      org.opencontainers.image.created=${DOCSEARCH_BUILD_DATE}

EXPOSE 80
