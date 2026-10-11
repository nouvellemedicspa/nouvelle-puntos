-- NOUVELLE PUNTOS · ESQUEMA PARA UN PROYECTO NUEVO DE SUPABASE
-- Este script NO debe ejecutarse en la base del sistema actual de sellos.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text,
  points numeric(12,2) not null default 0 check (points >= 0),
  total_spent numeric(12,2) not null default 0 check (total_spent >= 0),
  last_purchase date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  movement_date date not null default current_date,
  type text not null check (type in ('purchase','redeem','adjustment')),
  gross numeric(12,2) not null default 0,
  redeemed_mxn numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  points_delta numeric(12,2) not null default 0,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists movements_client_idx on public.movements(client_id, created_at desc);

alter table public.admin_users enable row level security;
alter table public.clients enable row level security;
alter table public.movements enable row level security;

revoke all on public.admin_users from anon, authenticated;
revoke all on public.clients from anon, authenticated;
revoke all on public.movements from anon, authenticated;

grant select on public.admin_users to authenticated;
create policy "admins can read own admin row" on public.admin_users for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()); $$;

-- Vista pública segura de una tarjeta por código. No devuelve teléfono.
create or replace function public.public_get_card(p_code text)
returns table(id uuid, code text, name text, points numeric, total_spent numeric, last_purchase date, expires_at date)
language sql stable security definer set search_path=public
as $$
  select c.id,c.code,c.name,c.points,c.total_spent,c.last_purchase,c.expires_at
  from public.clients c where lower(c.code)=lower(trim(p_code)) limit 1;
$$;

grant execute on function public.public_get_card(text) to anon, authenticated;

create or replace function public.public_get_movements(p_code text, p_limit integer default 8)
returns table(date date,type text,gross numeric,redeemed_mxn numeric,paid numeric,points_delta numeric,note text)
language sql stable security definer set search_path=public
as $$
  select m.movement_date,m.type,m.gross,m.redeemed_mxn,m.paid,m.points_delta,m.note
  from public.movements m join public.clients c on c.id=m.client_id
  where lower(c.code)=lower(trim(p_code))
  order by m.created_at desc limit greatest(1,least(coalesce(p_limit,8),50));
$$;
grant execute on function public.public_get_movements(text,integer) to anon, authenticated;

create or replace function public.admin_list_clients()
returns setof public.clients language plpgsql security definer set search_path=public
as $$ begin if not public.is_admin() then raise exception 'not authorized'; end if; return query select * from public.clients order by name; end $$;
grant execute on function public.admin_list_clients() to authenticated;

create or replace function public.admin_list_movements(p_client_id uuid,p_limit integer default 100)
returns setof public.movements language plpgsql security definer set search_path=public
as $$ begin if not public.is_admin() then raise exception 'not authorized'; end if; return query select * from public.movements where client_id=p_client_id order by created_at desc limit greatest(1,least(coalesce(p_limit,100),500)); end $$;
grant execute on function public.admin_list_movements(uuid,integer) to authenticated;

create or replace function public.next_client_code()
returns text language plpgsql security definer set search_path=public
as $$ declare n integer; begin
  select coalesce(max(nullif(regexp_replace(code,'\D','','g'),'')::integer),249)+1 into n from public.clients;
  return 'N-'||lpad(n::text,4,'0');
end $$;

create or replace function public.admin_create_client(p_name text,p_phone text default null)
returns public.clients language plpgsql security definer set search_path=public
as $$ declare r public.clients; begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'name required'; end if;
  insert into public.clients(code,name,phone) values(public.next_client_code(),trim(p_name),nullif(trim(p_phone),'')) returning * into r;
  return r;
end $$;
grant execute on function public.admin_create_client(text,text) to authenticated;

create or replace function public.admin_register_purchase(p_client_id uuid,p_gross numeric,p_redeem_mxn numeric default 0,p_note text default null)
returns public.clients language plpgsql security definer set search_path=public
as $$
declare c public.clients; v_redeem numeric; v_paid numeric; v_earned numeric; v_used numeric; begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_gross is null or p_gross <= 0 then raise exception 'invalid gross'; end if;
  select * into c from public.clients where id=p_client_id for update; if not found then raise exception 'client not found'; end if;
  v_redeem := greatest(0,least(coalesce(p_redeem_mxn,0),p_gross*.25,c.points*5));
  v_paid := round((p_gross-v_redeem)::numeric,2);
  v_earned := round((v_paid/100)::numeric,2); -- 1 punto por cada $100 = 5% de valor porque cada punto vale $5
  v_used := round((v_redeem/5)::numeric,2);
  update public.clients set points=round((points-v_used+v_earned)::numeric,2),total_spent=round((total_spent+v_paid)::numeric,2),last_purchase=current_date,expires_at=(current_date+interval '12 months')::date,updated_at=now() where id=c.id returning * into c;
  insert into public.movements(client_id,type,gross,redeemed_mxn,paid,points_delta,note,created_by) values(c.id,case when v_redeem>0 then 'redeem' else 'purchase' end,p_gross,v_redeem,v_paid,round((v_earned-v_used)::numeric,2),p_note,auth.uid());
  return c;
end $$;
grant execute on function public.admin_register_purchase(uuid,numeric,numeric,text) to authenticated;

create or replace function public.admin_adjust_points(p_client_id uuid,p_points_delta numeric,p_note text default null)
returns public.clients language plpgsql security definer set search_path=public
as $$ declare c public.clients; begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select * into c from public.clients where id=p_client_id for update; if not found then raise exception 'client not found'; end if;
  if c.points+coalesce(p_points_delta,0) < 0 then raise exception 'insufficient points'; end if;
  update public.clients set points=round((points+coalesce(p_points_delta,0))::numeric,2),updated_at=now() where id=c.id returning * into c;
  insert into public.movements(client_id,type,points_delta,note,created_by) values(c.id,'adjustment',coalesce(p_points_delta,0),p_note,auth.uid());
  return c;
end $$;
grant execute on function public.admin_adjust_points(uuid,numeric,text) to authenticated;

-- Después de crear una cuenta de administración en Supabase Authentication,
-- agrega su UUID aquí (reemplazar):
-- insert into public.admin_users(user_id) values ('00000000-0000-0000-0000-000000000000');
