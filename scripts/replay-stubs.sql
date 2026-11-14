-- Bouchons pour rejouer supabase/migrations sur l'image nue supabase/postgres.
-- La vraie pile Supabase (storage-api, realtime, gotrue) crée ces objets ; l'image seule non.
-- Exécuté en tant que supabase_admin par scripts/replay-migrations.sh.

create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

alter table auth.users
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists phone text,
  add column if not exists raw_user_meta_data jsonb,
  add column if not exists raw_app_meta_data jsonb,
  add column if not exists last_sign_in_at timestamptz,
  add column if not exists created_at timestamptz default now();

create table if not exists storage.buckets (
  id text primary key, name text not null, owner uuid, created_at timestamptz default now(),
  updated_at timestamptz default now(), public boolean default false, avif_autodetection boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner_id text);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  owner uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(), metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored, version text, owner_id text);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql as
$$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create or replace function storage.filename(name text) returns text language sql as
$$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
create or replace function storage.extension(name text) returns text language sql as
$$ select split_part(name, '.', 2) $$;
grant usage on schema storage to postgres, anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to postgres, service_role;
grant select on storage.buckets, storage.objects to anon, authenticated;
alter table storage.objects owner to postgres;
alter table storage.buckets owner to postgres;
alter function storage.foldername(text) owner to postgres;
alter function storage.filename(text) owner to postgres;
grant create on schema storage to postgres;

create table if not exists realtime.messages (
  id uuid default gen_random_uuid(), topic text not null, extension text not null default 'broadcast',
  payload jsonb, event text, private boolean default false,
  updated_at timestamp default now(), inserted_at timestamp default now());
alter table realtime.messages enable row level security;
alter table realtime.messages owner to postgres;
grant usage on schema realtime to postgres;
create or replace function realtime.topic() returns text language sql stable as
$$ select nullif(current_setting('realtime.topic', true), '') $$;
alter function realtime.topic() owner to postgres;
