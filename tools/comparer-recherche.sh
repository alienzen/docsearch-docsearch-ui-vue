#!/bin/bash
# Interroge /search à travers l'interface, sur un cas par dimension de
# recherche, et vérifie que chacun aboutit.
#
#     bash tools/comparer-recherche.sh
#
# Ce que ce script contrôle, c'est le CHEMIN DE PROXY de l'interface
# (nginx.conf) : un préfixe oublié ou mal écrit s'y voit immédiatement,
# la requête n'atteignant plus l'API. Le moteur lui-même est testé
# ailleurs.
#
# Jusqu'à la bascule, il envoyait les mêmes critères aux deux interfaces
# et comparait les totaux. Elles ne tournent plus en parallèle : il
# vérifie désormais que chaque cas renvoie un total exploitable. Les
# valeurs restent affichées — un écart d'un jour à l'autre se remarque à
# l'œil, et signale une variation du corpus plutôt qu'une régression.
#
# Prérequis : la stack dev tourne et l'utilisateur de test alice.admin
# existe côté LDAP.
set -u

HOTE=${HOTE:-192.168.56.101}
PORT=${PORT:-8080}

total() {
  curl -s -X POST "http://$HOTE:$PORT/search" \
    -H 'X-User: alice.admin' -H 'Content-Type: application/json' -d "$1" |
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

echecs=0
printf "%-22s %10s   %s\n" CAS TOTAL VERDICT
for cas in "${CAS[@]}"; do
  nom=${cas%%|*}
  corps=${cas#*|}
  t=$(total "$corps")
  # Un total non numérique signifie que la requête n'a pas abouti :
  # proxy cassé, API injoignable ou corps de réponse inattendu.
  if [[ "$t" =~ ^[0-9]+$ ]]; then
    verdict="abouti"
  else
    verdict="** ÉCHEC **"
    echecs=$((echecs + 1))
  fi
  printf "%-22s %10s   %s\n" "$nom" "$t" "$verdict"
done

echo
if [ "$echecs" -eq 0 ]; then
  echo "OK — ${#CAS[@]} cas, tous aboutis."
else
  echo "$echecs échec(s) — le proxy de l'interface ne transmet pas correctement."
  exit 1
fi
