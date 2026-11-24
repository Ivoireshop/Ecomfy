<#
  Miroir PROD -> VPS DE TEST (Supabase auto-hébergé, https://supabase.ecomfy.cloud).
  Variante de scripts/mirror-prod-to-dev.ps1 : même base (public + auth + historique des migrations) et mêmes
  fichiers Storage, mais la cible est la base du VPS, jointe par un TUNNEL SSH. La prod n'est lue qu'en lecture seule.
  La base du VPS est ÉCRASÉE. Pas d'étape Edge Functions : sur le VPS elles viennent du dépôt (voir docs/TEST-VPS-SELFHOSTED.md).

  Prérequis :
    - supabase CLI connecté (supabase login), psql dans le PATH, node, Docker Desktop démarré (le CLI lance pg_dump dans Docker)
    - Tunnel SSH ouvert dans une autre fenêtre, directement vers le conteneur de la base (Supavisor refuse postgres) :
        ssh -N -L 54322:<IP du conteneur supabase-db>:5432 root@<vps>
    - $env:VPS_DB_URL = postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/postgres
      (mot de passe du .env du VPS, encodé pour une URL)
    - -SkipVpsBackup : le pg_dump du CLI tourne dans Docker et ne voit pas le tunnel Windows
    - $env:VPS_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY du .env du VPS (étape Storage seulement)

  Usage :
    .\scripts\mirror-prod-to-vps.ps1          # vérifications seulement (aucune écriture)
    .\scripts\mirror-prod-to-vps.ps1 -Go      # exécute, après confirmation à taper
    options : -SkipDb  -SkipStorage  -SkipVpsBackup

  Après la copie, la base du VPS = la prod (historique compris). Les migrations du dépôt plus récentes que la prod
  s'appliquent ensuite SUR LE VPS avec : bash deploy/apply-migrations-vps.sh [--apply]
#>
param([switch]$Go, [switch]$SkipDb, [switch]$SkipStorage, [switch]$SkipVpsBackup)

$ErrorActionPreference = 'Stop'
$PROD    = 'yfggrceynzcwklbxhgix'
$DEV     = 'xfpbpxncserliskrbaim'
$VPS_API = 'https://supabase.ecomfy.cloud'
$repo = Split-Path -Parent $PSScriptRoot
$VpsUrl = $env:VPS_DB_URL

# ---------- Garde-fous : la cible ne peut être que le VPS, par le tunnel local ----------
if (-not $VpsUrl) { throw 'VPS_DB_URL non défini.' }
if ($VpsUrl -notmatch '@(127\.0\.0\.1|localhost):\d+/') { throw 'VPS_DB_URL doit passer par le tunnel SSH local (127.0.0.1:<port>). Abandon.' }
foreach ($bad in @($PROD, $DEV, 'supabase.co', 'supabase.com')) {
  if ($VpsUrl -match [regex]::Escape($bad)) { throw "VPS_DB_URL contient « $bad » : ce n'est pas le VPS. Abandon." }
}

function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what a échoué (code $LASTEXITCODE)" } }
function Psql([string]$extra, [string]$log) {
  # -w : ne jamais demander de mot de passe (le prompt serait invisible car la sortie est redirigée)
  $env:PGCONNECT_TIMEOUT = '15'
  $p = Start-Process psql -ArgumentList "-X -w $extra `"$VpsUrl`"" -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput "$log.out" -RedirectStandardError "$log.err"
  return $p.ExitCode
}
function ErrCount($log) {
  if (-not (Test-Path "$log.err")) { return 0 }
  @(Select-String -Path "$log.err" -Pattern 'ERROR').Count
}

$ts  = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $env:TEMP "mirror-vps-$ts"
New-Item -ItemType Directory -Force $out | Out-Null
Write-Host "Dossier de travail : $out (contient des données personnelles : à supprimer après usage)"

Write-Host "Connexion au VPS (tunnel)..."
if ((Psql "-At -c `"select current_database() || ' / ' || version()`"" "$out\ping") -ne 0) { throw "Connexion VPS impossible (tunnel ouvert ?), voir $out\ping.err" }
Write-Host "OK : $(Get-Content "$out\ping.out")"
# Contrôle supplémentaire : la base jointe doit être une instance auto-hébergée (pas de schéma propre au cloud).
Psql "-At -c `"select count(*) from pg_namespace where nspname in ('auth','storage')`"" "$out\schemas" | Out-Null
if ((Get-Content "$out\schemas.out") -ne '2') { throw "Schémas auth/storage absents sur la cible : démarrer toute la pile Supabase du VPS." }
Write-Host "PROD=$PROD  ->  VPS (tunnel)  ;  Storage -> $VPS_API"

if (-not $Go) {
  Write-Host "`nMode vérification : rien n'a été écrit. Relance avec -Go pour exécuter."
  return
}
$ans = Read-Host "La base du VPS de test va être ÉCRASÉE par une copie de la PROD. Tape MIROIR-VPS pour continuer"
if ($ans -ne 'MIROIR-VPS') { throw 'Annulé.' }

# ---------- 1. Base de données ----------
if (-not $SkipDb) {
  if (-not $SkipVpsBackup) {
    Write-Host "`n[1/7] Sauvegarde du VPS actuel"
    supabase db dump --db-url $VpsUrl -f "$out\vps_backup_schema.sql"; Check 'dump vps schema'
  }

  Write-Host "[2/7] Dump de la PROD (lecture seule)"
  supabase db dump --project-ref $PROD -f "$out\prod_schema.sql";                                   Check 'dump prod schema'
  # Schémas limités : sans -s, le dump contient aussi auth (en double avec prod_data_auth), pgmq (files absentes
  # du VPS : la COPY en échec emportait la table suivante) et deux tables Storage interdites au rôle postgres.
  supabase db dump --project-ref $PROD -f "$out\prod_data_public.sql" --data-only --use-copy -s public,storage -x storage.buckets_vectors,storage.vector_indexes,storage.migrations; Check 'dump prod data'
  supabase db dump --project-ref $PROD -f "$out\prod_data_auth.sql" --data-only --use-copy -s auth -x auth.schema_migrations; Check 'dump prod auth'
  supabase db dump --project-ref $PROD -f "$out\prod_data_migrations.sql" --data-only --use-copy -s supabase_migrations;       Check 'dump prod migrations'
  supabase db dump --project-ref $PROD -f "$out\prod_schema_auth.sql" -s auth;       Check 'dump prod auth schema'
  supabase db dump --project-ref $PROD -f "$out\prod_schema_storage.sql" -s storage; Check 'dump prod storage schema'

  # Déclencheurs et policies sur auth.* / storage.* qui dépendent de fonctions public (identique au miroir dev)
  $extras = New-Object System.Collections.Generic.List[string]
  $stmt = $null
  foreach ($line in (Get-Content "$out\prod_schema_auth.sql","$out\prod_schema_storage.sql")) {
    if ($stmt -eq $null) {
      if ($line -match '^CREATE (OR REPLACE )?TRIGGER .* ON "?(auth|storage)"?\..*EXECUTE (FUNCTION|PROCEDURE) "?public"?\.' -or
          $line -match '^CREATE POLICY .* ON "?storage"?\."?(objects|buckets)"?') { $stmt = $line } else { continue }
    } else { $stmt += "`n" + $line }
    if ($stmt -match ';\s*$') { $extras.Add($stmt); $stmt = $null }
  }
  Set-Content "$out\extras.sql" $extras -Encoding utf8
  Write-Host "      $(@($extras).Count) triggers/policies auth+storage à rejouer"

  Write-Host "[3/7] Restauration dans le VPS"
  @'
do $$ declare r record; begin
  for r in select t.tgname, c.relnamespace::regnamespace::text sch, c.relname
           from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
           where not t.tgisinternal and p.pronamespace = 'public'::regnamespace
             and c.relnamespace::regnamespace::text in ('auth','storage') loop
    execute format('drop trigger if exists %I on %I.%I', r.tgname, r.sch, r.relname);
  end loop;
  for r in select policyname, schemaname, tablename from pg_policies where schemaname = 'storage' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
'@ | Set-Content "$out\prelude.sql" -Encoding utf8
  @'
do $$ declare r record; begin
  -- DELETE (et non TRUNCATE) : voir mirror-prod-to-dev.ps1. Exécuté avec session_replication_role=replica.
  for r in select schemaname, tablename from pg_tables
           where (schemaname in ('auth','supabase_migrations') and not (schemaname = 'auth' and tablename = 'schema_migrations'))
              or (schemaname = 'pgmq' and (tablename like 'q\_%' or tablename like 'a\_%')) loop
    execute format('delete from %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;
'@ | Set-Content "$out\truncate.sql" -Encoding utf8

  # Instance de TEST exposée sur Internet : rien de la prod ne doit pouvoir y agir ni en partir.
  @'
-- Sessions et jetons de la prod : inutilisables ici (autre JWT secret), supprimés.
delete from auth.sessions; delete from auth.refresh_tokens; delete from auth.flow_state; delete from auth.one_time_tokens;
-- Files d'e-mails : aucun message de la prod ne doit être envoyé depuis le VPS.
do $$ declare r record; begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'pgmq' and (tablename like 'q\_%' or tablename like 'a\_%') loop
    execute format('delete from %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;
-- Contrôles (affichés) : aucun secret Vault ni tâche cron venus de la prod.
select 'vault.secrets', count(*) from vault.secrets
union all select 'cron.job', count(*) from cron.job
union all select 'auth.users', count(*) from auth.users
union all select 'historique migrations', count(*) from supabase_migrations.schema_migrations;
'@ | Set-Content "$out\sanitize.sql" -Encoding utf8

  $fwd = { param($f) ($f -replace '\\','/') }
  $steps = @(
    @('prelude',  "-f `"$(& $fwd "$out\prelude.sql")`""),
    @('schema',   "-f `"$(& $fwd "$out\prod_schema.sql")`""),
    @('extras',   "-f `"$(& $fwd "$out\extras.sql")`""),
    @('truncate', "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\truncate.sql")`""),
    @('data_public',     "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\prod_data_public.sql")`""),
    @('data_auth',       "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\prod_data_auth.sql")`""),
    @('data_migrations', "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\prod_data_migrations.sql")`""),
    @('sanitize', "-At -F , -f `"$(& $fwd "$out\sanitize.sql")`"")
  )
  foreach ($s in $steps) {
    $code = Psql $s[1] "$out\restore_$($s[0])"
    Write-Host ("      {0,-16} code={1}  erreurs={2}" -f $s[0], $code, (ErrCount "$out\restore_$($s[0])"))
  }
  Write-Host "      Contrôles après nettoyage :"; Get-Content "$out\restore_sanitize.out" | ForEach-Object { "        $_" }
  Write-Host "      Détail des erreurs : $out\restore_*.err"
  Write-Host "      (data_auth : des tables auth du cloud peuvent manquer dans la version GoTrue du VPS ; vérifier que auth.users est complet)"

  Write-Host "[4/7] Vérification des comptes de lignes (tables public)"
  $exp = @{}; $cur = $null
  foreach ($line in [IO.File]::ReadLines("$out\prod_data_public.sql")) {
    if ($cur) { if ($line -eq '\.') { $cur = $null } else { $exp[$cur]++ } }
    elseif ($line -match '^COPY (\S+) \(') { $cur = $matches[1] -replace '"',''; $exp[$cur] = 0 }
  }
  $sql = ($exp.Keys | Where-Object { $_ -like 'public.*' } | ForEach-Object {
            $q = ($_ -split '\.',2); "select '$_' t, count(*) n from public.`"$($q[1])`"" }) -join "`nunion all`n"
  Set-Content "$out\count.sql" ($sql + ';') -Encoding utf8
  Psql "-At -F , -f `"$(& $fwd "$out\count.sql")`"" "$out\count" | Out-Null
  $bad = 0
  foreach ($l in Get-Content "$out\count.out") {
    $t, $n = $l -split ','
    if ([int64]$n -ne $exp[$t]) { $bad++; Write-Host "      ECART $t : prod=$($exp[$t]) vps=$n" -ForegroundColor Red }
  }
  Write-Host "      $($exp.Count) tables comparées, $bad écart(s)"
}

# ---------- 2. Storage ----------
if (-not $SkipStorage) {
  Write-Host "`n[5/7] Fichiers Storage (prod -> $VPS_API)"
  if (-not $env:VPS_SERVICE_ROLE_KEY) { throw 'VPS_SERVICE_ROLE_KEY non défini (SERVICE_ROLE_KEY du .env du VPS).' }
  $keys = supabase projects api-keys --project-ref $PROD --reveal -o json | ConvertFrom-Json
  $k = $keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1
  if (-not $k) { $k = $keys | Where-Object { $_.api_key -like 'sb_secret_*' } | Select-Object -First 1 }
  if (-not $k) { throw "Clé service introuvable pour $PROD" }
  $env:SRC_URL = "https://$PROD.supabase.co"; $env:SRC_KEY = $k.api_key
  $env:DST_URL = $VPS_API;                   $env:DST_KEY = $env:VPS_SERVICE_ROLE_KEY
  $env:FAIL_LOG = "$out\storage-failures.log"
  # Les lignes storage.objects arrivent avec la base mais pas les fichiers : sans copie forcée, tout serait
  # jugé « déjà identique » et rien ne serait copié.
  $env:FORCE_COPY = '1'
  try { node "$repo\scripts\mirror-storage.mjs" } finally {
    Remove-Item Env:SRC_URL, Env:SRC_KEY, Env:DST_URL, Env:DST_KEY, Env:FORCE_COPY -ErrorAction SilentlyContinue
  }
}

Write-Host "`n[6/7] À faire ensuite SUR LE VPS (depuis le clone du dépôt, branche test/vps-selfhosted) :"
Write-Host "      bash deploy/apply-migrations-vps.sh           # liste les migrations du dépôt plus récentes que la prod"
Write-Host "      bash deploy/apply-migrations-vps.sh --apply   # les applique"
Write-Host "[7/7] Supprimer $out une fois les contrôles faits (données personnelles)."
Write-Host "`nTerminé."
