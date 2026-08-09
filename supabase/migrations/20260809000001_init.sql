-- WhatsOrder full schema (local-first, applies identically to cloud)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- user_profiles: one row per auth user; role drives dashboard access
-- ---------------------------------------------------------------------------
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'CSR',
  department text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- productos: catalog = single source of truth for price + stock
-- ---------------------------------------------------------------------------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pedidos: orders. items jsonb element = {sku,product,quantity,price,subtotal}
-- ---------------------------------------------------------------------------
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_phone text,
  telegram_chat_id text,
  customer_email text,
  customer_cedula text,
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','pending','approved','rejected','cancelled')),
  source text default 'telegram',
  delivery_address text,
  delivery_city text,
  delivery_zone text,
  delivery_instructions text,
  delivery_assigned_to text,
  delivery_status text,
  delivery_eta text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejection_reason text
);
create index if not exists pedidos_status_idx on pedidos(status);
create index if not exists pedidos_created_at_idx on pedidos(created_at desc);

-- ---------------------------------------------------------------------------
-- Serverless state (server/service-key only) + audit
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Row-Level Security. The server uses the service-role key and bypasses RLS.
-- ---------------------------------------------------------------------------
alter table user_profiles      enable row level security;
alter table productos          enable row level security;
alter table pedidos            enable row level security;
alter table conversation_state enable row level security;
alter table processed_updates  enable row level security;
alter table rate_limits        enable row level security;
alter table audit_log          enable row level security;

drop policy if exists pedidos_auth_all on pedidos;
create policy pedidos_auth_all on pedidos for all to authenticated using (true) with check (true);

drop policy if exists productos_auth_all on productos;
create policy productos_auth_all on productos for all to authenticated using (true) with check (true);

drop policy if exists profiles_auth_read on user_profiles;
create policy profiles_auth_read on user_profiles for select to authenticated using (true);

drop policy if exists audit_auth_read on audit_log;
create policy audit_auth_read on audit_log for select to authenticated using (true);
-- conversation_state, processed_updates, rate_limits: RLS on, NO policies => service-key only.

-- ---------------------------------------------------------------------------
-- Table-level GRANTs for PostgREST roles. RLS still gates ROW visibility.
-- service_role (secret key) bypasses RLS and needs full access.
-- authenticated (CSR after login) is row-gated by the policies above.
-- anon is intentionally granted nothing => unauthenticated reads are denied.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select, insert, update, delete on pedidos, productos to authenticated;
grant select on user_profiles, audit_log to authenticated;
