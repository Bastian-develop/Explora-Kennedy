-- Explora Kennedy: esquema inicial para un proyecto nuevo de Supabase (PostgreSQL).
-- Ejecutar en el SQL Editor de Supabase con un usuario propietario del proyecto.

create extension if not exists pgcrypto;

create table if not exists public.administrators (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.global_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  point_id text not null,
  author text not null,
  email text not null,
  text text not null,
  likes integer not null default 0 check (likes >= 0),
  created_at timestamptz not null default now(),
  constraint comments_author_length check (char_length(trim(author)) between 1 and 100),
  constraint comments_email_length check (char_length(trim(email)) between 3 and 254),
  constraint comments_text_length check (char_length(trim(text)) between 1 and 2000)
);

create index if not exists comments_point_created_idx
  on public.comments (point_id, created_at);

create or replace function public.is_explora_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.administrators
    where id = (select auth.uid())
  );
$$;

revoke all on function public.is_explora_admin() from public;
grant execute on function public.is_explora_admin() to authenticated;

alter table public.administrators enable row level security;
alter table public.global_state enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Admins can read own or directory" on public.administrators;
create policy "Admins can read own or directory"
  on public.administrators for select to authenticated
  using (id = (select auth.uid()) or (select public.is_explora_admin()));

drop policy if exists "Admins can revoke other admins" on public.administrators;
create policy "Admins can revoke other admins"
  on public.administrators for delete to authenticated
  using ((select public.is_explora_admin()) and id <> (select auth.uid()));

-- No se concede INSERT/UPDATE en administrators al cliente. Las altas se autorizan
-- desde SQL Editor después de crear al usuario en Authentication.
revoke all on public.administrators from anon, authenticated;
grant select, delete on public.administrators to authenticated;

drop policy if exists "Anyone can read place data" on public.global_state;
create policy "Anyone can read place data"
  on public.global_state for select to anon, authenticated
  using (true);

drop policy if exists "Admins can add place data" on public.global_state;
create policy "Admins can add place data"
  on public.global_state for insert to authenticated
  with check ((select public.is_explora_admin()));

drop policy if exists "Admins can update place data" on public.global_state;
create policy "Admins can update place data"
  on public.global_state for update to authenticated
  using ((select public.is_explora_admin()))
  with check ((select public.is_explora_admin()));

drop policy if exists "Admins can delete place data" on public.global_state;
create policy "Admins can delete place data"
  on public.global_state for delete to authenticated
  using ((select public.is_explora_admin()));

revoke all on public.global_state from anon, authenticated;
grant select on public.global_state to anon, authenticated;
grant insert, update, delete on public.global_state to authenticated;

-- Archivos multimedia: los visitantes solo leen; los administradores autorizados suben,
-- reemplazan o eliminan imágenes. Las imágenes históricas existentes siguen en /public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-media', 'place-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view place media" on storage.objects;
create policy "Public can view place media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'place-media');

drop policy if exists "Admins can upload place media" on storage.objects;
create policy "Admins can upload place media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'place-media' and (select public.is_explora_admin()));

drop policy if exists "Admins can update place media" on storage.objects;
create policy "Admins can update place media"
  on storage.objects for update to authenticated
  using (bucket_id = 'place-media' and (select public.is_explora_admin()))
  with check (bucket_id = 'place-media' and (select public.is_explora_admin()));

drop policy if exists "Admins can delete place media" on storage.objects;
create policy "Admins can delete place media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'place-media' and (select public.is_explora_admin()));

drop policy if exists "Anyone can read comments" on public.comments;
create policy "Anyone can read comments"
  on public.comments for select to anon, authenticated
  using (true);

drop policy if exists "Anyone can add a valid comment" on public.comments;
create policy "Anyone can add a valid comment"
  on public.comments for insert to anon, authenticated
  with check (
    char_length(trim(author)) between 1 and 100
    and char_length(trim(email)) between 3 and 254
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and char_length(trim(text)) between 1 and 2000
    and likes = 0
  );

drop policy if exists "Admins can edit comments" on public.comments;
create policy "Admins can edit comments"
  on public.comments for update to authenticated
  using ((select public.is_explora_admin()))
  with check ((select public.is_explora_admin()));

drop policy if exists "Admins can delete comments" on public.comments;
create policy "Admins can delete comments"
  on public.comments for delete to authenticated
  using ((select public.is_explora_admin()));

-- El correo de quien comenta no queda disponible mediante las consultas públicas.
revoke all on public.comments from anon, authenticated;
grant select (id, point_id, author, text, likes, created_at) on public.comments to anon, authenticated;
grant insert (id, point_id, author, email, text, likes, created_at) on public.comments to anon, authenticated;
grant update, delete on public.comments to authenticated;

create or replace function public.increment_comment_likes(p_comment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_likes integer;
begin
  update public.comments
  set likes = likes + 1
  where id = p_comment_id
  returning likes into updated_likes;

  if updated_likes is null then
    raise exception 'Comment not found';
  end if;

  return updated_likes;
end;
$$;

revoke all on function public.increment_comment_likes(uuid) from public;
grant execute on function public.increment_comment_likes(uuid) to anon, authenticated;

-- Copia inicial de los cuatro lugares que ya están definidos en el proyecto.
-- No reemplaza una edición que ya exista en global_state.
insert into public.global_state (id, data)
values (
  'places_v1',
  $places$[
    {"id":"p_timiza","name":"Parque Timiza","description":"Un gran parque urbano, ideal para recreación y deporte.","latitude":4.610091,"longitude":-74.153938,"media":[{"type":"image","url":"/img/img_parquetimiza/parque_timiza_1.jpg","title":"Lago del Parque Timiza"},{"type":"podcast","url":"/img/img_parquetimiza/parque_timiza_podcast.wav","title":"Historia Viva: Los orígenes de Timiza"},{"type":"video","url":"https://www.youtube.com/embed/Kz8isLP8r8A","title":"Recorrido en bici"}],"comments":[]},
    {"id":"p_banderas","name":"Monumento a las Banderas","description":"Ubicado en el corazón de la localidad, este monumento representa el panamericanismo y es un símbolo histórico y cultural de Kennedy.","latitude":4.63139,"longitude":-74.14833,"media":[{"type":"image","url":"/img/img_banderas/Banderas.png","title":"Monumento a las Banderas"},{"type":"image","url":"/img/img_banderas/IMG_0248.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0264.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0283.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0300.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0305.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0307.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0309.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0315.JPG","title":""},{"type":"image","url":"/img/img_banderas/IMG_0317.JPG","title":""},{"type":"video","url":"https://www.youtube.com/embed/tY6hfl7fX_g","title":"Recorrido en bici"},{"type":"podcast","url":"/img/img_banderas/Capítulo 2_ Madrinas del monumento de Banderas.wav","title":"Historia banderas"}],"comments":[]},
    {"id":"p2","name":"Humedal El Burro","description":"Reserva natural importante para el ecosistema de la ciudad.","latitude":4.641616,"longitude":-74.14999,"media":[{"type":"image","url":"/img/img_humedaldelburro/Humedal-El-Burro.png","title":"Fauna del humedal"},{"type":"podcast","url":"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3","title":"Historias del Humedal"}],"comments":[]},
    {"id":"p3","name":"Corabastos","description":"La central de abastos más grande de la ciudad.","latitude":4.630245,"longitude":-74.158753,"media":[{"type":"image","url":"/img/img_corabastos/corabastos.png","title":"Mercado de frutas"},{"type":"video","url":"/img/img_corabastos/ABASTOS PARA FAGUS 2026.mp4","title":"Recorriendo Abastos"}],"comments":[]}
  ]$places$::jsonb
)
on conflict (id) do nothing;

-- Alta inicial de una cuenta administradora:
-- 1. Créala desde Supabase Dashboard > Authentication > Users.
-- 2. Reemplaza el correo de ejemplo y ejecuta:
-- insert into public.administrators (id, email)
-- select id, lower(email) from auth.users where lower(email) = lower('admin@ejemplo.com')
-- on conflict (id) do nothing;
