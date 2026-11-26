#!/usr/bin/env bash
# Applique supabase/migrations sur la base Supabase AUTO-HÉBERGÉE du VPS de test (conteneur Docker local).
# Ne se connecte à aucun projet cloud : tout passe par `docker exec` dans le conteneur de la base.
#
# Usage (sur le VPS, depuis la racine du dépôt) :
#   bash deploy/apply-migrations-vps.sh            # liste ce qui reste à appliquer, n'applique rien
#   bash deploy/apply-migrations-vps.sh --apply    # applique, s'arrête à la première erreur
#   bash deploy/apply-migrations-vps.sh --mark-applied <liste.txt>
#                                                  # inscrit ces fichiers dans l'historique SANS les exécuter
# Variables facultatives :
#   DB_CONTAINER   conteneur de la base (défaut supabase-db)
#   SKIP_VERSIONS  versions à ne jamais appliquer (défaut : celles qui ne sont pas en prod volontairement)
#     20260906000000 : corporate_invitations ouverte à anon (USING true)
#     20260908170000 : buckets shop-assets/avatars avec dépôt libre
#     20260909100000 20260911120000 20260912000000 20261022150000 20261023140000 20261023150000 :
#       facturation par seuil, absente de la prod ; 20260909100000 remettrait aussi une ancienne version
#       de get_shop_orders_secure (recul du masquage des commandes des boutiques restreintes)
#
# Usage après scripts/mirror-prod-to-vps.ps1 : la base contient la prod et son historique, mais cet historique
# est incomplet (migrations passées en prod sans y être inscrites). Avant --apply :
#   bash deploy/apply-migrations-vps.sh --mark-applied deploy/vps-migrations-deja-en-prod.txt
# puis seules les migrations vraiment absentes de la prod sont proposées.
#
# Chaque fichier passe dans une transaction (psql -1) : un échec n'en laisse rien.
# L'historique est inscrit dans supabase_migrations.schema_migrations (format du CLI Supabase) :
# le script est relançable, les versions déjà inscrites sont ignorées.
# Le mot de passe reste dans le conteneur (variable PGPASSWORD / POSTGRES_PASSWORD du service db).
set -u
DB="${DB_CONTAINER:-supabase-db}"
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
MARK_LIST=""
if [ "${1:-}" = "--mark-applied" ]; then
  MARK_LIST="${2:-}"; [ -f "$MARK_LIST" ] || { echo "Liste introuvable : '$MARK_LIST'"; exit 2; }
fi
SKIP_VERSIONS="${SKIP_VERSIONS-20260906000000 20260908170000 20260909100000 20260911120000 20260912000000 20261022150000 20261023140000 20261023150000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; command -v cygpath >/dev/null && ROOT="$(cygpath -m "$ROOT")"
MIG_DIR="$ROOT/supabase/migrations"
IN_DB=/tmp/ecomfy-migrations

psql_db() { # psql_db <arguments psql...>
  docker exec -i "$DB" sh -c 'PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}" exec psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"' sh "$@"
}

docker inspect "$DB" >/dev/null 2>&1 || { echo "Conteneur $DB introuvable (docker ps)"; exit 2; }
[ -d "$MIG_DIR" ] || { echo "Dossier $MIG_DIR introuvable"; exit 2; }

# Pré-contrôles : les services auth, storage et realtime doivent avoir créé leurs schémas.
checks=$(psql_db -tAc "select
  (to_regclass('auth.users') is not null)::int,
  (to_regclass('storage.buckets') is not null)::int,
  (to_regclass('storage.objects') is not null)::int,
  (select count(*) from pg_publication where pubname='supabase_realtime'),
  (select count(*) from pg_available_extensions where name in ('pg_cron','pg_net','pgmq','supabase_vault','unaccent'))") \
  || { echo "Connexion à la base impossible"; exit 2; }
IFS='|' read -r has_users has_buckets has_objects has_pub n_ext <<<"$checks"
echo "auth.users=$has_users storage.buckets=$has_buckets storage.objects=$has_objects publication_realtime=$has_pub extensions=$n_ext/5"
if [ "$has_users" != 1 ] || [ "$has_buckets" != 1 ] || [ "$has_objects" != 1 ] || [ "$n_ext" != 5 ]; then
  echo "Pré-contrôle en échec : démarrer toute la pile (docker compose up -d) et attendre auth/storage avant de relancer."
  exit 2
fi

psql_db -qc "create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
  -- Journal par fichier : deux fichiers du dépôt partagent une version (20261023100000) et la clé de
  -- schema_migrations ne peut en inscrire qu'un.
  create table if not exists supabase_migrations.vps_applied_files (file text primary key, applied_at timestamptz default now());" >/dev/null \
  || { echo "Création de la table d'historique impossible"; exit 2; }

if [ -n "$MARK_LIST" ]; then
  # Inscription sans exécution : pour les migrations dont les objets sont déjà en base.
  names=$(grep -vE '^\s*(#|$)' "$MARK_LIST" | tr -d '\r')
  for f in $names; do
    [ -f "$MIG_DIR/$f" ] || { echo "Fichier absent du dépôt : $f (rien n'a été inscrit)"; exit 2; }
  done
  n=0
  for f in $names; do
    v="${f%%_*}"; name="${f#*_}"; name="${name%.sql}"
    psql_db -qc "insert into supabase_migrations.schema_migrations(version, name) values ('$v', '$name') on conflict (version) do nothing;
      insert into supabase_migrations.vps_applied_files(file) values ('$f') on conflict do nothing;" >/dev/null \
      || { echo "Inscription impossible pour $f, arrêt après $n"; exit 1; }
    n=$((n+1))
  done
  echo "Inscrites sans exécution : $n migration(s). Relancer sans option pour voir ce qui reste à appliquer."
  exit 0
fi

applied=$(psql_db -tAc "select version from supabase_migrations.schema_migrations")
applied_pairs=$(psql_db -tAc "select version || '|' || coalesce(name, '') from supabase_migrations.schema_migrations")
applied_files=$(psql_db -tAc "select file from supabase_migrations.vps_applied_files")
n_public=$(psql_db -tAc "select count(*) from pg_tables where schemaname='public'")
if [ -z "$applied" ] && [ "$n_public" != 0 ]; then
  echo "Le schéma public contient déjà $n_public tables mais aucun historique : état inattendu, arrêt."
  exit 2
fi
dup_versions=$(ls "$MIG_DIR" | grep '\.sql$' | cut -d_ -f1 | sort | uniq -d)

pending=(); skipped=(); ambiguous=()
for path in $(ls "$MIG_DIR"/*.sql | sort); do
  f=$(basename "$path"); v="${f%%_*}"; name="${f#*_}"; name="${name%.sql}"
  grep -qxF "$f" <<<"$applied_files" && continue
  grep -qxF "$v|$name" <<<"$applied_pairs" && continue
  if grep -qx "$v" <<<"$applied"; then
    # Version déjà inscrite sous un autre nom : sans doublon de version, c'est ce fichier (nom différent) ;
    # avec doublon, on ne sait pas si celui-ci a été appliqué : il est proposé, à vérifier.
    grep -qx "$v" <<<"$dup_versions" || continue
    ambiguous+=("$f")
  fi
  if grep -qw "$v" <<<"$SKIP_VERSIONS"; then skipped+=("$f"); else pending+=("$f"); fi
done
echo "Migrations : $(ls "$MIG_DIR"/*.sql | wc -l) dans le dépôt, $(grep -c . <<<"$applied") dans l'historique de la base, ${#pending[@]} à appliquer, ${#skipped[@]} écartée(s)."
[ "${#skipped[@]}" -gt 0 ] && printf '  écartée : %s\n' "${skipped[@]}"
[ "${#ambiguous[@]}" -gt 0 ] && printf '  À VÉRIFIER (version en double, l autre fichier est dans l historique) : %s\n' "${ambiguous[@]}"
[ "${#pending[@]}" = 0 ] && exit 0
if [ "$APPLY" = 0 ]; then
  printf '  à appliquer : %s\n' "${pending[@]}"
  echo "Rien n'a été appliqué. Relancer avec --apply."
  exit 0
fi

docker exec "$DB" rm -rf "$IN_DB" && docker cp "$MIG_DIR" "$DB:$IN_DB" || { echo "Copie impossible"; exit 2; }
ok=0
for f in "${pending[@]}"; do
  v="${f%%_*}"; name="${f#*_}"; name="${name%.sql}"
  if out=$(psql_db -1 -q -f "$IN_DB/$f" 2>&1 >/dev/null) && ! grep -qE "ERROR|FATAL" <<<"$out"; then
    psql_db -qc "insert into supabase_migrations.schema_migrations(version, name) values ('$v', '$name') on conflict (version) do nothing;
      insert into supabase_migrations.vps_applied_files(file) values ('$f') on conflict do nothing;" >/dev/null \
      || echo "     (attention : inscription dans l'historique impossible pour $f)"
    ok=$((ok+1)); echo "ok   $f"
  else
    echo "ECHEC $f"; grep -m3 -E "ERROR|FATAL|DETAIL|HINT" <<<"$out"
    echo "Arrêt : $ok appliquée(s), $f annulée (transaction), $(( ${#pending[@]} - ok - 1 )) non tentée(s)."
    docker exec "$DB" rm -rf "$IN_DB"
    exit 1
  fi
done
docker exec "$DB" rm -rf "$IN_DB"
echo "Terminé : $ok migration(s) appliquée(s)."
