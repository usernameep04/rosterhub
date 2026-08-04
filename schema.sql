-- ============================================================
-- ESQUEMA DE BASE DE DATOS — Roster de Modelos IA
-- Ejecuta esto una sola vez en Supabase: SQL Editor > New query > Run
-- ============================================================

create table if not exists models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text not null,
  tags text[] default '{}',
  socials jsonb default '{}',
  created_at timestamptz default now()
);

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

-- Por ahora (sin login) dejamos las tablas abiertas a lectura/escritura
-- pública para que el flujo funcione. Cuando agregues login, esto se
-- cambia para exigir sesión iniciada antes de escribir.

alter table models enable row level security;
alter table model_media enable row level security;
alter table model_ratings enable row level security;

create policy "lectura publica models" on models for select using (true);
create policy "escritura publica models" on models for insert with check (true);

create policy "lectura publica media" on model_media for select using (true);
create policy "escritura publica media" on model_media for insert with check (true);

create policy "lectura publica ratings" on model_ratings for select using (true);
create policy "escritura publica ratings" on model_ratings for insert with check (true);

-- Nota: también debes crear un bucket de Storage llamado "model-media"
-- (Storage > New bucket > público) para que las fotos y videos se puedan
-- subir y mostrar. Ver README.md para el paso a paso.
