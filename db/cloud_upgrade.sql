-- =====================================================================
-- WhatsOrder CLOUD upgrade (idempotent). Brings the EXISTING cloud Supabase
-- (which already has `pedidos` and `user_profiles`) up to the same target
-- schema the local `supabase/migrations/20260809000001_init.sql` produces.
-- Safe to run more than once. Apply via the Supabase SQL Editor OR psql.
-- =====================================================================
create extension if not exists pgcrypto;

-- 1) Catalog -----------------------------------------------------------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Extend pedidos (ALTER, because the table already exists on cloud) --
alter table pedidos add column if not exists telegram_chat_id text;
alter table pedidos add column if not exists customer_email text;
alter table pedidos add column if not exists customer_cedula text;
alter table pedidos add column if not exists delivery_city text;
alter table pedidos add column if not exists delivery_zone text;
alter table pedidos add column if not exists delivery_instructions text;
alter table pedidos add column if not exists delivery_assigned_to text;
alter table pedidos add column if not exists delivery_status text;
alter table pedidos add column if not exists delivery_eta text;
alter table pedidos add column if not exists confirmed_at timestamptz;
alter table pedidos add column if not exists rejected_by uuid;
alter table pedidos add column if not exists rejected_at timestamptz;
alter table pedidos add column if not exists rejection_reason text;
alter table pedidos add column if not exists approved_by uuid;
alter table pedidos add column if not exists approved_at timestamptz;
alter table pedidos add column if not exists created_by uuid;
alter table pedidos add column if not exists notes text;
alter table pedidos add column if not exists delivery_address text;
-- Cloud pedidos has a pre-existing BEFORE UPDATE trigger (update_pedidos_updated_at)
-- that sets NEW.updated_at; without this column every UPDATE on pedidos errors.
alter table pedidos add column if not exists updated_at timestamptz default now();
-- Legacy cloud pedidos (WhatsApp era) has customer_phone NOT NULL. Telegram orders
-- have no phone, so insertDraft omits it and the insert would violate the constraint,
-- failing every Telegram order with a generic error. Relax it to match the canonical
-- schema (migrations/20260809000001_init.sql: customer_phone is nullable).
alter table pedidos alter column customer_phone drop not null;
create index if not exists pedidos_status_idx on pedidos(status);
create index if not exists pedidos_created_at_idx on pedidos(created_at desc);

-- 3) Serverless state + audit -----------------------------------------
create table if not exists conversation_state (
  chat_id text primary key,
  state text not null,
  draft jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists processed_updates (
  update_id bigint primary key,
  processed_at timestamptz not null default now()
);
create table if not exists rate_limits (
  chat_id text primary key,
  window_start timestamptz not null,
  count int not null default 0
);
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid,
  actor_type text not null check (actor_type in ('csr','customer','bot','system')),
  actor_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_pedido_idx on audit_log(pedido_id);

-- 4) Seed catalog (idempotent) ----------------------------------------
insert into productos (sku, name, price, stock) values
  ('aceite-1l','Aceite vegetal 1L',180.00,120),
  ('arroz-5lb','Arroz premium 5lb',220.00,200),
  ('leche-1l','Leche entera 1L',65.00,300),
  ('cafe-500g','Café molido 500g',320.00,80),
  ('pollo-2kg','Pollo entero 2kg',380.00,60),
  ('pan-molde','Pan de molde',95.00,90),
  ('agua-6l','Agua embotellada 6L',130.00,150),
  ('jabon-liquido','Jabón líquido',110.00,100),
  ('huevos-docena','Huevos (docena)',150.00,120),
  ('azucar-5lb','Azúcar crema 5lb',160.00,140),
  ('habichuelas-1lb','Habichuelas rojas 1lb',70.00,180),
  ('espagueti-1lb','Espagueti 1lb',55.00,160),
  ('salami-1lb','Salami 1lb',140.00,70),
  ('platano-unidad','Plátano (unidad)',15.00,400)
on conflict (sku) do nothing;

-- 5) Backfill legacy pedidos.items to canonical {sku,product,quantity,price,subtotal}.
--    Handles BOTH legacy shapes: seed rows {product,quantity,subtotal} and
--    old bot rows {id,quantity,price,stock}. Only touches elements lacking 'sku'.
update pedidos p set items = (
  select jsonb_agg(
    jsonb_build_object(
      'sku',      coalesce(c.sku, 'unknown'),
      'product',  coalesce(it->>'product', it->>'name', it->>'id', 'producto'),
      'quantity', coalesce((it->>'quantity')::int, 1),
      'price',    round(coalesce(
                    c.price,
                    nullif(it->>'price','')::numeric,
                    case when coalesce((it->>'quantity')::int,0) > 0
                         then (nullif(it->>'subtotal','')::numeric) / (it->>'quantity')::int end,
                    0), 2),
      'subtotal', round(coalesce(
                    nullif(it->>'subtotal','')::numeric,
                    coalesce(c.price, nullif(it->>'price','')::numeric, 0) * coalesce((it->>'quantity')::int,1)
                  ), 2)
    )
  )
  from jsonb_array_elements(p.items) it
  left join productos c
    on lower(c.name) = lower(coalesce(it->>'product', it->>'name', it->>'id'))
)
where jsonb_typeof(p.items) = 'array'
  and exists (select 1 from jsonb_array_elements(p.items) e where not (e ? 'sku'));

-- recompute total from normalized items
update pedidos p set total = coalesce((
  select round(sum((it->>'subtotal')::numeric), 2)
  from jsonb_array_elements(p.items) it
), 0)
where jsonb_typeof(p.items) = 'array';

-- 6) Normalize source + status, then enforce the status CHECK ----------
update pedidos set source = 'telegram' where source = 'whatsapp';
update pedidos set source = coalesce(source, 'manual');
-- map any legacy status outside the allowed set to 'pending' (there should be none)
update pedidos set status = 'pending'
  where status not in ('pending_confirmation','pending','approved','rejected','cancelled');
alter table pedidos drop constraint if exists pedidos_status_check;
alter table pedidos add constraint pedidos_status_check
  check (status in ('pending_confirmation','pending','approved','rejected','cancelled'));

-- 7) RLS + policies + grants (idempotent) ------------------------------
alter table user_profiles      enable row level security;
alter table productos          enable row level security;
alter table pedidos            enable row level security;
alter table conversation_state enable row level security;
alter table processed_updates  enable row level security;
alter table rate_limits        enable row level security;
alter table audit_log          enable row level security;

-- Drop legacy WIDE-OPEN policies from the original cloud setup (no-ops locally).
drop policy if exists "Enable read access for all users" on pedidos;
drop policy if exists "Enable insert for all users" on pedidos;
drop policy if exists "Enable update for all users" on pedidos;
drop policy if exists "Enable delete for all users" on pedidos;
drop policy if exists "CSR pueden insertar pedidos" on pedidos;
drop policy if exists "Supervisores y admins pueden actualizar pedidos" on pedidos;
drop policy if exists "Usuarios autenticados pueden leer pedidos" on pedidos;

drop policy if exists pedidos_auth_all on pedidos;
drop policy if exists pedidos_auth_read on pedidos;
create policy pedidos_auth_read on pedidos for select to authenticated using (true);
drop policy if exists productos_auth_all on productos;
drop policy if exists productos_auth_read on productos;
create policy productos_auth_read on productos for select to authenticated using (true);
drop policy if exists profiles_auth_read on user_profiles;
create policy profiles_auth_read on user_profiles for select to authenticated using (true);
drop policy if exists audit_auth_read on audit_log;
create policy audit_auth_read on audit_log for select to authenticated using (true);
-- conversation_state, processed_updates, rate_limits: RLS on, NO policies => service-key only.

-- Revoke the broad legacy table grants (original setup gave anon+authenticated
-- full INSERT/UPDATE/DELETE), then re-grant precisely. anon ends with NOTHING.
revoke all on pedidos, productos, user_profiles, audit_log, conversation_state, processed_updates, rate_limits from anon;
revoke all on pedidos, productos, user_profiles, audit_log, conversation_state, processed_updates, rate_limits from authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select on pedidos, productos to authenticated;
grant select on user_profiles, audit_log to authenticated;
