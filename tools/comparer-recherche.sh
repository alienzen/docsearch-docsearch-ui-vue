#!/bin/bash
# Envoie les mêmes critères de recherche aux deux interfaces et compare
# le nombre de résultats.
#
#     bash tools/comparer-recherche.sh
#
# Les deux passent par le même docsearch-api : ce que ce script vérifie,
# c'est que le chemin de proxy de la nouvelle interface (nginx.conf)
# transmet bien les requêtes à l'identique — un préfixe oublié ou mal
# écrit s'y verrait immédiatement.
#
# Prérequis : la stack dev tourne (ports 8080 et 8081) et l'utilisateur
# de test alice.admin existe côté LDAP.
set -u

HOTE=${HOTE:-192.168.56.101}
ANCIEN=${ANCIEN:-8080}
NOUVEAU=${NOUVEAU:-8081}

total() {
  curl -s -X POST "http://$HOTE:$1/search" \
    -H 'X-User: alice.admin' -H 'Content-Type: application/json' -d "$2" |
    python3 -c "import json,sys; print(json.load(sys.stdin)['total'])" 2>/dev/null ||
    echo ERR
}

# Un cas par dimension de recherche : « libellé|corps JSON ».
CAS=(
  'texte libre|{"query":"rapport","size":1,"from":0}'
  'phrase exacte|{"query":"\"budget annuel\"","size":1,"from":0}'
  'filtre extension|{"query":"rapport","extension":[".pdf"],"size":1,"from":0}'
  'extensions cumulées|{"query":"rapport","extension":[".pdf",".docx"],"size":1,"from":0}'
  'filtre auteur|{"query":"","author":["Félicie Rongey"],"size":1,"from":0}'
  'filtre source|{"query":"rapport","source":["documents"],"size":1,"from":0}'
  'période|{"query":"rapport","date_from":"2020-01-01","date_to":"2021-12-31","size":1,"from":0}'
  'tri par date|{"query":"rapport","sort":"date_modified","size":1,"from":0}'
  'critères combinés|{"query":"rapport","extension":[".docx"],"source":["documents"],"date_from":"2015-01-01","size":1,"from":0}'
)

divergences=0
printf "%-22s %8s %8s   %s\n" CAS "$ANCIEN" "$NOUVEAU" VERDICT
for cas in "${CAS[@]}"; do
  nom=${cas%%|*}
  corps=${cas#*|}
  a=$(total "$ANCIEN" "$corps")
  b=$(total "$NOUVEAU" "$corps")
  if [ "$a" = "$b" ]; then
    verdict="identique"
  else
    verdict="** DIVERGENCE **"
    divergences=$((divergences + 1))
  fi
  printf "%-22s %8s %8s   %s\n" "$nom" "$a" "$b" "$verdict"
done

echo
if [ "$divergences" -eq 0 ]; then
  echo "OK — ${#CAS[@]} cas, totaux identiques des deux côtés."
else
  echo "$divergences divergence(s)."
  exit 1
fi
