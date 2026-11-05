<#
  Miroir PROD -> DEV : base (public + auth + historique des migrations), fichiers Storage, Edge Functions.
  La prod n'est lue qu'en lecture seule. Le DEV est ÉCRASÉ.

  Prérequis :
    - supabase CLI connecté (supabase login), psql dans le PATH, node
    - $env:DEV_DB_URL = chaîne "Session pooler" du DEV (Dashboard > Connect), mot de passe encodé
      ex: postgresql://postgres.xfpbpxncserliskrbaim:MDP@aws-0-<region>.pooler.supabase.com:5432/postgres

  Usage :
    .\scripts\mirror-prod-to-dev.ps1          # vérifications seulement (aucune écriture)
    .\scripts\mirror-prod-to-dev.ps1 -Go      # exécute, après confirmation à taper
    options : -SkipDb  -SkipStorage  -SkipFunctions
#>
param([switch]$Go, [switch]$SkipDb, [switch]$SkipStorage, [switch]$SkipFunctions)

$ErrorActionPreference = 'Stop'
$PROD = 'yfggrceynzcwklbxhgix'
$DEV  = 'xfpbpxncserliskrbaim'
$repo = Split-Path -Parent $PSScriptRoot
$DevUrl = $env:DEV_DB_URL

# ---------- Garde-fous ----------
if (-not $DevUrl) { throw 'DEV_DB_URL non défini.' }
if ($DevUrl -notmatch [regex]::Escape($DEV)) { throw "DEV_DB_URL ne contient pas la ref du DEV ($DEV). Abandon." }
if ($DevUrl -match [regex]::Escape($PROD))   { throw 'DEV_DB_URL contient la ref de la PROD. Abandon.' }
if ($PROD -eq $DEV) { throw 'PROD et DEV identiques.' }

function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what a échoué (code $LASTEXITCODE)" } }
function Psql([string]$extra, [string]$log) {
  # -w : ne jamais demander de mot de passe (le prompt serait invisible car la sortie est redirigée)
  $env:PGCONNECT_TIMEOUT = '15'
  $p = Start-Process psql -ArgumentList "-X -w $extra `"$DevUrl`"" -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput "$log.out" -RedirectStandardError "$log.err"
  return $p.ExitCode
}
function ErrCount($log) {
  if (-not (Test-Path "$log.err")) { return 0 }
  @(Select-String -Path "$log.err" -Pattern 'ERROR').Count
}

$ts  = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $env:TEMP "mirror-$ts"
New-Item -ItemType Directory -Force $out | Out-Null
Write-Host "Dossier de travail : $out"

Write-Host "Connexion au DEV..."
if ((Psql "-At -c `"select current_database()`"" "$out\ping") -ne 0) { throw "Connexion DEV impossible, voir $out\ping.err" }
Write-Host "OK. PROD=$PROD  ->  DEV=$DEV"

if (-not $Go) {
  Write-Host "`nMode vérification : rien n'a été écrit. Relance avec -Go pour exécuter."
  return
}
$ans = Read-Host "Le DEV ($DEV) va être ÉCRASÉ. Tape MIROIR pour continuer"
if ($ans -ne 'MIROIR') { throw 'Annulé.' }

# ---------- 1. Base de données ----------
if (-not $SkipDb) {
  Write-Host "`n[1/6] Sauvegarde du DEV actuel"
  supabase db dump --db-url $DevUrl -f "$out\dev_backup_schema.sql";            Check 'dump dev schema'
  supabase db dump --db-url $DevUrl -f "$out\dev_backup_data.sql" --data-only --use-copy; Check 'dump dev data'

  Write-Host "[2/6] Dump de la PROD (lecture seule)"
  supabase db dump --project-ref $PROD -f "$out\prod_schema.sql";                                   Check 'dump prod schema'
  supabase db dump --project-ref $PROD -f "$out\prod_data_public.sql" --data-only --use-copy;       Check 'dump prod data'
  supabase db dump --project-ref $PROD -f "$out\prod_data_auth.sql" --data-only --use-copy -s auth -x auth.schema_migrations; Check 'dump prod auth'
  supabase db dump --project-ref $PROD -f "$out\prod_data_migrations.sql" --data-only --use-copy -s supabase_migrations;       Check 'dump prod migrations'
  supabase db dump --project-ref $PROD -f "$out\prod_schema_auth.sql" -s auth;       Check 'dump prod auth schema'
  supabase db dump --project-ref $PROD -f "$out\prod_schema_storage.sql" -s storage; Check 'dump prod storage schema'

  # Déclencheurs et policies sur auth.* / storage.* qui dépendent de fonctions public
  # Les policies peuvent s'étendre sur plusieurs lignes : on lit chaque instruction jusqu'au « ; » final.
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

  Write-Host "[3/6] Restauration dans le DEV"
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
'@ | Set-Content "$out\prelude.sql" -Encoding utf8
  @'
do $$ declare r record; begin
  -- DELETE (et non TRUNCATE) : le TRUNCATE en cascade touche public.wallet_ledger (registre immuable)
  -- et « restart identity » exige d'être propriétaire des séquences auth. Exécuté avec session_replication_role=replica.
  for r in select schemaname, tablename from pg_tables
           where (schemaname in ('auth','supabase_migrations') and not (schemaname = 'auth' and tablename = 'schema_migrations'))
              or (schemaname = 'pgmq' and (tablename like 'q\_%' or tablename like 'a\_%')) loop
    execute format('delete from %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;
'@ | Set-Content "$out\truncate.sql" -Encoding utf8

  $fwd = { param($f) ($f -replace '\\','/') }
  $steps = @(
    @('prelude',  "-f `"$(& $fwd "$out\prelude.sql")`""),
    @('schema',   "-f `"$(& $fwd "$out\prod_schema.sql")`""),
    @('extras',   "-f `"$(& $fwd "$out\extras.sql")`""),
    @('truncate', "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\truncate.sql")`""),
    @('data_public',     "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\prod_data_public.sql")`""),
    @('data_auth',       "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\prod_data_auth.sql")`""),
    @('data_migrations', "-c `"set session_replication_role = replica`" -f `"$(& $fwd "$out\prod_data_migrations.sql")`"")
  )
  foreach ($s in $steps) {
    $code = Psql $s[1] "$out\restore_$($s[0])"
    Write-Host ("      {0,-16} code={1}  erreurs={2}" -f $s[0], $code, (ErrCount "$out\restore_$($s[0])"))
  }
  Write-Host "      Détail des erreurs : $out\restore_*.err (les « already exists » sur objets gérés sont normaux)"

  Write-Host "[4/6] Vérification des comptes de lignes (tables public)"
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
    if ([int64]$n -ne $exp[$t]) { $bad++; Write-Host "      ECART $t : prod=$($exp[$t]) dev=$n" -ForegroundColor Red }
  }
  Write-Host "      $($exp.Count) tables comparées, $bad écart(s)"
}

# ---------- 2. Storage ----------
if (-not $SkipStorage) {
  Write-Host "`n[5/6] Fichiers Storage"
  function Get-Key($ref) {
    $keys = supabase projects api-keys --project-ref $ref --reveal -o json | ConvertFrom-Json
    $k = $keys | Where-Object { $_.name -eq 'service_role' } | Select-Object -First 1
    if (-not $k) { $k = $keys | Where-Object { $_.api_key -like 'sb_secret_*' } | Select-Object -First 1 }
    if (-not $k) { throw "Clé service introuvable pour $ref" }
    $k.api_key
  }
  $env:SRC_URL = "https://$PROD.supabase.co"; $env:SRC_KEY = Get-Key $PROD
  $env:DST_URL = "https://$DEV.supabase.co";  $env:DST_KEY = Get-Key $DEV
  $env:FAIL_LOG = "$out\storage-failures.log"
  try { node "$repo\scripts\mirror-storage.mjs" } finally {
    Remove-Item Env:SRC_URL, Env:SRC_KEY, Env:DST_URL, Env:DST_KEY -ErrorAction SilentlyContinue
  }
}

# ---------- 3. Edge Functions ----------
if (-not $SkipFunctions) {
  Write-Host "`n[6/6] Edge Functions (code déployé en prod -> dev)"
  $work = Join-Path $out 'fnwork'
  New-Item -ItemType Directory -Force "$work\supabase\functions" | Out-Null
  Copy-Item "$repo\supabase\config.toml" "$work\supabase\config.toml"   # verify_jwt par fonction
  $fns = supabase functions list --project-ref $PROD -o json | ConvertFrom-Json
  foreach ($f in $fns) {
    $slug = if ($f.slug) { $f.slug } else { $f.name }
    Write-Host "      télécharge $slug"
    supabase functions download $slug --project-ref $PROD --use-api --workdir $work; Check "download $slug"
  }
  supabase functions deploy --project-ref $DEV --use-api --workdir $work --yes; Check 'deploy dev'

  Write-Host "`nSecrets : valeurs non copiables. Noms présents en prod mais absents du dev :"
  $ps = (supabase secrets list --project-ref $PROD -o json | ConvertFrom-Json).name
  $ds = (supabase secrets list --project-ref $DEV  -o json | ConvertFrom-Json).name
  $ps | Where-Object { $_ -notin $ds } | ForEach-Object { "   - $_" }
}

Write-Host "`nTerminé. Journaux et sauvegarde du dev : $out"
