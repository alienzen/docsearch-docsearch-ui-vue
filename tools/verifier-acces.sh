#!/bin/bash
# Vérifie le contrôle d'accès de l'interface, page par page et
# utilisateur par utilisateur, contre une matrice ATTENDUE.
#
#     bash tools/verifier-acces.sh
#
# C'EST LE CONTRÔLE CRITIQUE de la migration Vue/DSFR : le build
# multi-pages a été choisi pour que Nginx puisse continuer à protéger
# chaque page AVANT de servir le HTML (auth_request). Une SPA à point
# d'entrée unique aurait servi la page d'administration à tout le monde,
# en ne laissant que l'API refuser les appels — ce script est ce qui
# prouve que ce n'est pas arrivé.
#
# Jusqu'à la bascule, il comparait les codes de l'ancienne interface
# (8080) et de la nouvelle (8081), qui tournaient en parallèle. Elles ne
# tournent plus ensemble : la référence n'est donc plus l'autre
# interface mais la matrice ci-dessous — ce qui vaut mieux, une
# comparaison ne détectant rien quand les deux côtés se trompent
# pareillement.
#
# Prérequis : la stack dev tourne, avec les utilisateurs de test LDAP
# alice.admin (docsearch-admins + docsearch-users) et bob.user
# (docsearch-users seul) — voir
# docsearch-infra/HOWTO-simuler-utilisateur.md.
set -u

HOTE=${HOTE:-192.168.56.101}
PORT=${PORT:-8080}

code() {
  curl -s -o /dev/null -w "%{http_code}" -H "X-User: $1" "http://$HOTE:$PORT$2"
}

# chemin|attendu alice.admin|attendu bob.user|attendu sans en-tête
#
# /assets/ est un répertoire : 404 pour qui a le droit d'entrer, 401
# pour les autres — c'est le refus qu'on teste, pas le 404.
ATTENDU="
/|200|200|401
/help|200|200|401
/chat|200|200|401
/admin|200|401|401
/admin.html|200|401|401
/admin-help|200|200|401
/stats-help|200|200|401
/stats.html|200|200|401
/assets/|404|404|401
"

ecarts=0
printf "%-16s %-14s %8s %8s   %s\n" PAGE UTILISATEUR OBTENU ATTENDU VERDICT
while IFS='|' read -r chemin a b c; do
  [ -z "$chemin" ] && continue
  i=0
  # Le troisième « utilisateur » est l'absence de header X-User : une
  # requête non authentifiée, refusée partout.
  for utilisateur in alice.admin bob.user ""; do
    i=$((i + 1))
    case $i in 1) attendu=$a ;; 2) attendu=$b ;; 3) attendu=$c ;; esac
    libelle=${utilisateur:-"(aucun)"}
    obtenu=$(code "$utilisateur" "$chemin")
    if [ "$obtenu" = "$attendu" ]; then
      verdict="conforme"
    else
      verdict="** ÉCART **"
      ecarts=$((ecarts + 1))
    fi
    printf "%-16s %-14s %8s %8s   %s\n" "$chemin" "$libelle" "$obtenu" "$attendu" "$verdict"
  done
done <<< "$ATTENDU"

echo
if [ "$ecarts" -eq 0 ]; then
  echo "OK — contrôle d'accès conforme à la matrice attendue."
else
  echo "$ecarts écart(s) — NE PAS DÉPLOYER en l'état."
  exit 1
fi
