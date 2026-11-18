#!/usr/bin/env bash
# Rejoue supabase/migrations sur une base Supabase VIERGE et jetable (M11 de l'audit).
# Aucune connexion à la dev ni à la prod : tout se passe dans un conteneur Docker local.
#
# Usage : scripts/replay-migrations.sh [--keep]
#   --keep  garde le conteneur "ecomfy-replay" pour inspecter la base ensuite
# Code de sortie : 0 si toutes les migrations passent, 1 sinon.
# Même image que la dev (17.11.0.003) ; à changer ici si la dev change de version.
set -u
export MSYS_NO_PATHCONV=1
IMAGE="public.ecr.aws/supabase/postgres:17.11.0.003"
NAME="ecomfy-replay"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; command -v cygpath >/dev/null && ROOT="$(cygpath -m "$ROOT")"
KEEP=0; [ "${1:-}" = "--keep" ] && KEEP=1

docker rm -f "$NAME" >/dev/null 2>&1
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null || { echo "Docker indisponible"; exit 2; }
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2; done
# L'image redémarre une fois pendant son initialisation : on attend deux réponses stables.
sleep 5; docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 || sleep 10

docker cp "$ROOT/scripts/replay-stubs.sql" "$NAME:/stubs.sql"
docker exec "$NAME" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q -f /stubs.sql >/dev/null || { echo "Bouchons en échec"; exit 2; }
docker cp "$ROOT/supabase/migrations" "$NAME:/mig"

ok=0; fail=0
for f in $(docker exec "$NAME" ls /mig | sort); do
  out=$(docker exec "$NAME" psql -U postgres -h localhost -d postgres -1 -v ON_ERROR_STOP=1 -q -f "/mig/$f" 2>&1 >/dev/null | grep -m1 -E "ERROR|FATAL")
  if [ -n "$out" ]; then fail=$((fail+1)); echo "ECHEC $f :: ${out#*ERROR:  }"; else ok=$((ok+1)); fi
done
echo "migrations : ok=$ok echec=$fail"
[ "$KEEP" = 1 ] || docker rm -f "$NAME" >/dev/null 2>&1
[ "$fail" = 0 ]
