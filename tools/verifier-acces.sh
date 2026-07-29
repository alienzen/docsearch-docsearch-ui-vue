#!/bin/bash
# Vérifie que la nouvelle interface (port 8081) applique EXACTEMENT le
# même contrôle d'accès que l'historique (port 8080), page par page et
# utilisateur par utilisateur.
#
#     bash tools/verifier-acces.sh
#
# C'est LE contrôle critique de la migration : le build multi-pages a
# été choisi pour que Nginx puisse continuer à protéger chaque page
# AVANT de servir le HTML (auth_request). Une SPA à point d'entrée
# unique aurait servi la page d'administration à tout le monde, en ne
# laissant que l'API refuser les appels — ce script est ce qui prouve
# que ce n'est pas arrivé.
#
# Prérequis : la stack dev tourne, avec les utilisateurs de test LDAP
# alice.admin (docsearch-admins + docsearch-users) et bob.user
# (docsearch-users seul) — voir
# docsearch-infra/HOWTO-simuler-utilisateur.md.
set -u

HOTE=${HOTE:-192.168.56.101}
ANCIEN=${ANCIEN:-8080}
NOUVEAU=${NOUVEAU:-8081}

code() {
  curl -s -o /dev/null -w "%{http_code}" -H "X-User: $1" "http://$HOTE:$2$3"
}

divergences=0
printf "%-16s %-14s %8s %8s   %s\n" PAGE UTILISATEUR "$ANCIEN" "$NOUVEAU" VERDICT
for chemin in / /help /chat /admin /admin.html /admin-help /stats.html /assets/; do
  # Le troisième « utilisateur » est l'absence de header X-User : une
  # requête non authentifiée, qui doit être refusée partout.
  for utilisateur in alice.admin bob.user ""; do
    libelle=${utilisateur:-"(aucun)"}
    a=$(code "$utilisateur" "$ANCIEN" "$chemin")
    b=$(code "$utilisateur" "$NOUVEAU" "$chemin")
    if [ "$a" = "$b" ]; then
      verdict="identique"
    else
      verdict="** DIVERGENCE **"
      divergences=$((divergences + 1))
    fi
    printf "%-16s %-14s %8s %8s   %s\n" "$chemin" "$libelle" "$a" "$b" "$verdict"
  done
done

echo
if [ "$divergences" -eq 0 ]; then
  echo "OK — contrôle d'accès identique sur les deux interfaces."
else
  echo "$divergences divergence(s) — NE PAS BASCULER en l'état."
  exit 1
fi
