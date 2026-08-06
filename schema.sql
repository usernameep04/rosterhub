-- ============================================================
-- ESQUEMA DE BASE DE DATOS — Roster de Modelos IA
-- ============================================================
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo esto > Run.
--
-- Es seguro correrlo más de una vez (por ejemplo, si estás armando un
-- proyecto de Supabase nuevo desde cero) — no truena si las tablas o
-- los permisos ya existen.
-- ============================================================

-- ---------- TABLAS ----------

create table if not exists models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text not null,
  slug text,
  tags text[] default '{}',
  socials jsonb default '{}',
  created_at timestamptz default now()
);

-- Si la tabla "models" ya existía de antes (sin la columna slug), esto la agrega:
alter table models add column if not exists slug text;
create unique index if not exists idx_models_slug on models(slug);

create table if not exists model_media (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references models(id) on delete cascade,
  url text not null,
  type text not null check (type in ('image', 'video')),
  created_at timestamptz default now()
);

create table if not exists model_ratings (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references models(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz default now()
);

create index if not exists idx_media_model on model_media(model_id);
create index if not exists idx_ratings_model on model_ratings(model_id);

-- ---------- PERMISOS DE LAS TABLAS ----------
-- Por ahora (sin login) dejamos las tablas abiertas a lectura/escritura/
-- edición/borrado público para que el flujo funcione. Cuando agregues
-- login, esto se cambia para exigir sesión iniciada antes de escribir.

alter table models enable row level security;
alter table model_media enable row level security;
alter table model_ratings enable row level security;

drop policy if exists "lectura publica models" on models;
create policy "lectura publica models" on models for select using (true);

drop policy if exists "escritura publica models" on models;
create policy "escritura publica models" on models for insert with check (true);

drop policy if exists "editar publico models" on models;
create policy "editar publico models" on models for update using (true) with check (true);

drop policy if exists "borrar publico models" on models;
create policy "borrar publico models" on models for delete using (true);

drop policy if exists "lectura publica media" on model_media;
create policy "lectura publica media" on model_media for select using (true);

drop policy if exists "escritura publica media" on model_media;
create policy "escritura publica media" on model_media for insert with check (true);

drop policy if exists "borrar publico media" on model_media;
create policy "borrar publico media" on model_media for delete using (true);

drop policy if exists "lectura publica ratings" on model_ratings;
create policy "lectura publica ratings" on model_ratings for select using (true);

drop policy if exists "escritura publica ratings" on model_ratings;
create policy "escritura publica ratings" on model_ratings for insert with check (true);

-- ---------- STORAGE (fotos y videos) ----------
-- También debes crear un bucket llamado exactamente "model-media"
-- (Storage > New bucket > márcalo como público). Ver README.md.
--
-- IMPORTANTE: marcar el bucket como "público" solo permite LEER los
-- archivos vía su URL pública. Para SUBIR y BORRAR archivos hacen falta
-- estos permisos adicionales sobre la tabla interna de Storage:

drop policy if exists "insertar archivos model-media" on storage.objects;
create policy "insertar archivos model-media"
on storage.objects
for insert
to public
with check (bucket_id = 'model-media');

drop policy if exists "leer archivos model-media" on storage.objects;
create policy "leer archivos model-media"
on storage.objects
for select
to public
using (bucket_id = 'model-media');

drop policy if exists "borrar archivos model-media" on storage.objects;
create policy "borrar archivos model-media"
on storage.objects
for delete
to public
using (bucket_id = 'model-media');
