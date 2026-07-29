# ── docsearch-ui-vue — Interface web Vue 3 + DSFR ─────────────
# Deux étapes : compilation du bundle avec Vite, puis une image Nginx
# qui ne contient que le résultat (aucun node_modules en production).
#
# Nginx sert les pages construites ET proxifie /search, /document,
# /ask... vers docsearch-api, comme le fait docsearch-ui — l'interface
# fonctionne donc seule, sans dépendre du reverse proxy de production.

FROM node:22-alpine AS build
WORKDIR /app
# package*.json d'abord : cette couche (l'installation, la plus longue)
# n'est refaite que si les dépendances changent, pas à chaque édition
# de source.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
