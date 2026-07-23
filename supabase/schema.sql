-- THE AFTER HOURS – Supabase database setup
-- Run this file once in Supabase SQL Editor on a new project.

create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9._-]{3,40}$'),
  email text not null,
  full_name text not null,
  role text not null default 'cashier' check (role in ('owner','administrator','shift_lead','cashier','inventory')),
  permissions text[] not null default '{}',
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  tax_rate numeric(5,2) not null default 10 check (tax_rate between 0 and 100),
  organization_discount numeric(5,2) not null default 0 check (organization_discount between 0 and 100),
  stock numeric(14,3) not null default 0 check (stock >= 0),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  unit text not null default 'Stück',
  consumable boolean not null default true,
  producible boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  image_url text not null default '',
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  tax_rate numeric(5,2) not null default 10 check (tax_rate between 0 and 100),
  organization_discount numeric(5,2) not null default 0 check (organization_discount between 0 and 100),
  available_quantity numeric(14,3) not null default 0 check (available_quantity >= 0),
  active boolean not null default true,
  producible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_ingredients (
  menu_id uuid not null references public.menus(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(14,3) not null check (quantity > 0),
  primary key (menu_id, ingredient_id)
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.order_number_seq start 1000;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  sales_location text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  organization_name text not null default '',
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null check (total >= 0),
  received_amount numeric(12,2) not null default 0 check (received_amount >= 0),
  change_amount numeric(12,2) not null default 0 check (change_amount >= 0),
  payment_method text not null check (payment_method in ('cash','card')),
  tip numeric(12,2) not null default 0 check (tip >= 0),
  employee_id uuid not null references public.profiles(id),
  employee_name text not null,
  status text not null default 'completed' check (status in ('open','completed','cancelled','refunded')),
  cancellation_reason text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references public.ingredients(id) on delete set null,
  ingredient_name text not null,
  quantity numeric(14,3) not null check (quantity <> 0),
  reason text not null,
  order_id uuid references public.orders(id) on delete set null,
  employee_id uuid references public.profiles(id),
  employee_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id uuid references public.profiles(id),
  author_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id),
  employee_name text not null default 'System',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  entity_name text not null default '',
  details text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_employee_id on public.orders(employee_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_stock_movements_ingredient on public.stock_movements(ingredient_id, created_at desc);
create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);
create index if not exists idx_menu_ingredients_ingredient on public.menu_ingredients(ingredient_id);

do $$
begin
  alter table public.stock_movements alter column ingredient_id drop not null;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_ingredients'::regclass
      and conname = 'menu_ingredients_ingredient_id_fkey'
  ) then
    alter table public.menu_ingredients drop constraint menu_ingredients_ingredient_id_fkey;
  end if;

  alter table public.menu_ingredients
    add constraint menu_ingredients_ingredient_id_fkey
    foreign key (ingredient_id) references public.ingredients(id) on delete cascade;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_ingredient_id_fkey'
  ) then
    alter table public.stock_movements drop constraint stock_movements_ingredient_id_fkey;
  end if;

  alter table public.stock_movements
    add constraint stock_movements_ingredient_id_fkey
    foreign key (ingredient_id) references public.ingredients(id) on delete set null;
end $$;

-- ---------------------------------------------------------------------------
-- Initial settings
-- ---------------------------------------------------------------------------
insert into public.settings(key, value) values
  ('company_name', '"THE AFTER HOURS"'::jsonb),
  ('currency', '"USD"'::jsonb),
  ('default_tax_rate', '10'::jsonb),
  ('address', '""'::jsonb),
  ('contact_email', '""'::jsonb),
  ('phone', '""'::jsonb),
  ('order_prefix', '"AH"'::jsonb),
  ('payment_methods', '["cash","card"]'::jsonb),
  ('sales_locations', '["Hauptkasse","Bar","Terrasse"]'::jsonb),
  ('categories', '["Burger","Snacks","Getränke","Cocktails","Desserts"]'::jsonb),
  ('tip_rules', '"Trinkgeld wird separat ausgewiesen."'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Authorization helpers (not exposed through the Data API)
-- ---------------------------------------------------------------------------
create or replace function private.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p from public.profiles p where p.id = (select auth.uid()) limit 1;
$$;

create or replace function private.can_use_app()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.active and not p.must_change_password from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function private.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.active and not p.must_change_password and (
      p.role in ('owner','administrator')
      or permission_name = any(p.permissions)
      or (p.role = 'shift_lead' and permission_name = any(array[
        'orders.create','orders.view','orders.cancel','menus.manage','ingredients.manage',
        'stock.manage','organizations.manage','discounts.use','audit.view','notices.manage'
      ]::text[]))
      or (p.role = 'cashier' and permission_name = any(array['orders.create','orders.view','discounts.use']::text[]))
      or (p.role = 'inventory' and permission_name = any(array['ingredients.manage','stock.manage','menus.manage','audit.view']::text[]))
    )
    from public.profiles p
    where p.id = (select auth.uid())
  ), false);
$$;

revoke all on function private.current_profile() from public;
revoke all on function private.can_use_app() from public;
revoke all on function private.has_permission(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_use_app() to authenticated;
grant execute on function private.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Updated-at and audit triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text := 'System';
  row_data jsonb;
  entity_id text;
  entity_name text;
begin
  if tg_table_name = 'ingredients' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'stock' - 'updated_at') = (to_jsonb(old) - 'stock' - 'updated_at') then
    return new;
  end if;

  if actor_id is not null then
    select p.full_name into actor_name from public.profiles p where p.id = actor_id;
    actor_name := coalesce(actor_name, 'Unbekannter Mitarbeiter');
  end if;

  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_id := coalesce(row_data->>'id', row_data->>'key', '');
  entity_name := coalesce(row_data->>'name', row_data->>'full_name', row_data->>'title', row_data->>'key', '');

  insert into public.audit_logs(employee_id, employee_name, action, entity_type, entity_id, entity_name, details, metadata)
  values (actor_id, actor_name, lower(tg_table_name || '.' || tg_op), tg_table_name, entity_id, entity_name,
          case tg_op when 'INSERT' then 'Datensatz wurde erstellt.' when 'UPDATE' then 'Datensatz wurde bearbeitet.' else 'Datensatz wurde gelöscht.' end,
          jsonb_build_object('operation', tg_op));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create or replace trigger settings_updated_at before update on public.settings for each row execute function public.set_updated_at();
create or replace trigger ingredients_updated_at before update on public.ingredients for each row execute function public.set_updated_at();
create or replace trigger menus_updated_at before update on public.menus for each row execute function public.set_updated_at();
create or replace trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create or replace trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create or replace trigger notices_updated_at before update on public.notices for each row execute function public.set_updated_at();

create or replace trigger audit_settings after insert or update or delete on public.settings for each row execute function public.audit_table_change();
create or replace trigger audit_ingredients after insert or update or delete on public.ingredients for each row execute function public.audit_table_change();
create or replace trigger audit_menus after insert or update or delete on public.menus for each row execute function public.audit_table_change();
create or replace trigger audit_organizations after insert or update or delete on public.organizations for each row execute function public.audit_table_change();
create or replace trigger audit_notices after insert or update or delete on public.notices for each row execute function public.audit_table_change();

create or replace function public.protect_discount_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_discount numeric := 0;
  new_discount numeric := 0;
begin
  if tg_table_name = 'organizations' then
    old_discount := case when tg_op='INSERT' then 0 else coalesce(old.discount_value,0) end;
    new_discount := coalesce(new.discount_value,0);
    if tg_op='UPDATE' and (old.discount_type is distinct from new.discount_type) then
      old_discount := -1;
    end if;
  else
    old_discount := case when tg_op='INSERT' then 0 else coalesce(old.organization_discount,0) end;
    new_discount := coalesce(new.organization_discount,0);
  end if;

  if old_discount is distinct from new_discount and not (select private.has_permission('discounts.manage')) then
    raise exception 'Keine Berechtigung zum Ändern von Rabatten.';
  end if;
  return new;
end;
$$;

create or replace trigger protect_menu_discounts before insert or update on public.menus for each row execute function public.protect_discount_fields();
create or replace trigger protect_ingredient_discounts before insert or update on public.ingredients for each row execute function public.protect_discount_fields();
create or replace trigger protect_organization_discounts before insert or update on public.organizations for each row execute function public.protect_discount_fields();

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.audit_table_change() from public, anon, authenticated;
revoke all on function public.protect_discount_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic order and stock RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p_payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  item jsonb;
  usage_row record;
  stock_usage jsonb;
  normalized_items jsonb := '[]'::jsonb;
  menu_row public.menus;
  ingredient_row public.ingredients;
  recipe_row record;
  quantity numeric(14,3);
  line_total numeric(12,2);
  subtotal_value numeric(12,2) := 0;
  tax_value numeric(12,2) := 0;
  discount_value numeric(12,2) := 0;
  total_value numeric(12,2) := 0;
  organization_row public.organizations;
  org_id uuid;
  payment text;
  received numeric(12,2);
  tip_value numeric(12,2);
  change_value numeric(12,2);
  prefix text;
  order_no text;
  created_order public.orders;
begin
  if not (select private.has_permission('orders.create')) then
    raise exception 'Keine Berechtigung zum Erstellen von Bestellungen.';
  end if;

  select * into actor from public.profiles where id = (select auth.uid());
  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'Die Bestellung enthält keine Positionen.';
  end if;

  for item in select * from jsonb_array_elements(p_payload->'items') loop
    stock_usage := '[]'::jsonb;
    quantity := coalesce((item->>'quantity')::numeric, 0);
    if quantity <= 0 then raise exception 'Ungültige Bestellmenge.'; end if;

    if item->>'type' = 'menu' then
      select * into menu_row from public.menus where id = (item->>'reference_id')::uuid and active = true;
      if not found then raise exception 'Menü nicht verfügbar.'; end if;

      for recipe_row in
        select mi.ingredient_id, mi.quantity as recipe_quantity, i.name, i.stock
        from public.menu_ingredients mi
        join public.ingredients i on i.id = mi.ingredient_id
        where mi.menu_id = menu_row.id
        for update of i
      loop
        if recipe_row.stock < recipe_row.recipe_quantity * quantity then
          raise exception 'Nicht genügend Lagerbestand für %.', recipe_row.name;
        end if;
        stock_usage := stock_usage || jsonb_build_array(jsonb_build_object(
          'ingredient_id',recipe_row.ingredient_id,'name',recipe_row.name,'quantity',recipe_row.recipe_quantity * quantity
        ));
      end loop;

      line_total := round(menu_row.sale_price * quantity, 2);
      subtotal_value := subtotal_value + line_total;
      tax_value := tax_value + round(line_total - line_total / (1 + menu_row.tax_rate / 100), 2);
      normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
        'type','menu','reference_id',menu_row.id,'name',menu_row.name,'quantity',quantity,
        'unit_price',menu_row.sale_price,'tax_rate',menu_row.tax_rate,'stock_usage',stock_usage
      ));
    elsif item->>'type' = 'ingredient' then
      select * into ingredient_row from public.ingredients where id = (item->>'reference_id')::uuid and active = true for update;
      if not found then raise exception 'Zutat nicht verfügbar.'; end if;
      if ingredient_row.stock < quantity then raise exception 'Nicht genügend Lagerbestand für %.', ingredient_row.name; end if;
      line_total := round(ingredient_row.sale_price * quantity, 2);
      subtotal_value := subtotal_value + line_total;
      tax_value := tax_value + round(line_total - line_total / (1 + ingredient_row.tax_rate / 100), 2);
      stock_usage := jsonb_build_array(jsonb_build_object(
        'ingredient_id',ingredient_row.id,'name',ingredient_row.name,'quantity',quantity
      ));
      normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
        'type','ingredient','reference_id',ingredient_row.id,'name',ingredient_row.name,'quantity',quantity,
        'unit_price',ingredient_row.sale_price,'tax_rate',ingredient_row.tax_rate,'stock_usage',stock_usage
      ));
    else
      raise exception 'Unbekannter Positionstyp.';
    end if;
  end loop;

  org_id := nullif(p_payload->>'organization_id','')::uuid;
  if org_id is not null then
    if not (select private.has_permission('discounts.use')) then raise exception 'Keine Berechtigung für Organisationsrabatte.'; end if;
    select * into organization_row from public.organizations where id = org_id and active = true;
    if not found then raise exception 'Organisation ist nicht verfügbar.'; end if;
    if organization_row.discount_type = 'percent' then
      discount_value := round(subtotal_value * least(organization_row.discount_value,100) / 100, 2);
    else
      discount_value := least(subtotal_value, organization_row.discount_value);
    end if;
  end if;

  total_value := greatest(0, round(subtotal_value - discount_value, 2));
  if subtotal_value > 0 then tax_value := round(tax_value * (total_value / subtotal_value), 2); end if;
  payment := p_payload->>'payment_method';
  if payment not in ('cash','card') then raise exception 'Ungültige Zahlungsart.'; end if;
  tip_value := greatest(0, coalesce((p_payload->>'tip')::numeric,0));
  received := case when payment='card' then total_value + tip_value else greatest(0,coalesce((p_payload->>'received_amount')::numeric,0)) end;
  if payment='cash' and received < total_value then raise exception 'Erhaltener Betrag ist zu niedrig.'; end if;
  change_value := case when payment='cash' then round(received-total_value,2) else 0 end;

  select trim(both '"' from value::text) into prefix from public.settings where key='order_prefix';
  prefix := coalesce(nullif(prefix,''),'AH');
  order_no := prefix || '-' || nextval('public.order_number_seq');

  insert into public.orders(order_number,sales_location,organization_id,organization_name,discount_amount,subtotal,tax_amount,total,received_amount,change_amount,payment_method,tip,employee_id,employee_name,status,items)
  values(order_no,coalesce(nullif(p_payload->>'sales_location',''),'Hauptkasse'),org_id,coalesce(organization_row.name,''),discount_value,subtotal_value,tax_value,total_value,received,change_value,payment,tip_value,actor.id,actor.full_name,'completed',normalized_items)
  returning * into created_order;

  for item in select * from jsonb_array_elements(normalized_items) loop
    for usage_row in select value from jsonb_array_elements(item->'stock_usage') as usage_items(value) loop
      quantity := (usage_row.value->>'quantity')::numeric;
      update public.ingredients set stock=stock-quantity where id=(usage_row.value->>'ingredient_id')::uuid;
      insert into public.stock_movements(ingredient_id,ingredient_name,quantity,reason,order_id,employee_id,employee_name)
      values((usage_row.value->>'ingredient_id')::uuid,usage_row.value->>'name',-quantity,'Verkauf '||order_no,created_order.id,actor.id,actor.full_name);
    end loop;
  end loop;

  insert into public.audit_logs(employee_id,employee_name,action,entity_type,entity_id,entity_name,details,metadata)
  values(actor.id,actor.full_name,'order.created','order',created_order.id::text,order_no,'Bestellung über '||total_value||' erstellt.',jsonb_build_object('total',total_value,'payment_method',payment,'discount',discount_value,'tip',tip_value));

  return created_order;
end;
$$;

create or replace function public.change_stock(p_ingredient_id uuid, p_quantity numeric, p_reason text)
returns public.ingredients
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  ingredient public.ingredients;
begin
  if not (select private.has_permission('stock.manage')) then raise exception 'Keine Berechtigung für Lageränderungen.'; end if;
  if p_quantity = 0 then raise exception 'Die Mengenänderung darf nicht 0 sein.'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Ein Grund ist erforderlich.'; end if;
  select * into actor from public.profiles where id=(select auth.uid());
  select * into ingredient from public.ingredients where id=p_ingredient_id for update;
  if not found then raise exception 'Zutat nicht gefunden.'; end if;
  if ingredient.stock + p_quantity < 0 then raise exception 'Der Lagerbestand darf nicht negativ werden.'; end if;
  update public.ingredients set stock=stock+p_quantity where id=p_ingredient_id returning * into ingredient;
  insert into public.stock_movements(ingredient_id,ingredient_name,quantity,reason,employee_id,employee_name)
  values(ingredient.id,ingredient.name,p_quantity,p_reason,actor.id,actor.full_name);
  insert into public.audit_logs(employee_id,employee_name,action,entity_type,entity_id,entity_name,details,metadata)
  values(actor.id,actor.full_name,'stock.changed','ingredient',ingredient.id::text,ingredient.name,p_reason,jsonb_build_object('quantity',p_quantity,'new_stock',ingredient.stock));
  return ingredient;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_new_status text, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  target_order public.orders;
  item jsonb;
  usage_row record;
  recipe_row record;
  quantity numeric(14,3);
begin
  if p_new_status='refunded' then
    if not (select private.has_permission('orders.refund')) and not (select private.has_permission('orders.cancel')) then raise exception 'Keine Berechtigung für Rückerstattungen.'; end if;
  elsif p_new_status='cancelled' then
    if not (select private.has_permission('orders.cancel')) then raise exception 'Keine Berechtigung für Stornierungen.'; end if;
  else raise exception 'Ungültiger Zielstatus.';
  end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Eine Begründung ist erforderlich.'; end if;
  select * into actor from public.profiles where id=(select auth.uid());
  select * into target_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Bestellung nicht gefunden.'; end if;
  if target_order.status not in ('open','completed') then raise exception 'Bestellung wurde bereits storniert oder zurückerstattet.'; end if;

  for item in select * from jsonb_array_elements(target_order.items) loop
    if jsonb_typeof(item->'stock_usage') = 'array' then
      for usage_row in select value from jsonb_array_elements(item->'stock_usage') as usage_items(value) loop
        quantity := (usage_row.value->>'quantity')::numeric;
        update public.ingredients set stock=stock+quantity where id=(usage_row.value->>'ingredient_id')::uuid;
        insert into public.stock_movements(ingredient_id,ingredient_name,quantity,reason,order_id,employee_id,employee_name)
        values((usage_row.value->>'ingredient_id')::uuid,usage_row.value->>'name',quantity,case when p_new_status='refunded' then 'Rückerstattung ' else 'Stornierung ' end||target_order.order_number,target_order.id,actor.id,actor.full_name);
      end loop;
    elsif item->>'type'='ingredient' then
      quantity := (item->>'quantity')::numeric;
      update public.ingredients set stock=stock+quantity where id=(item->>'reference_id')::uuid;
      insert into public.stock_movements(ingredient_id,ingredient_name,quantity,reason,order_id,employee_id,employee_name)
      values((item->>'reference_id')::uuid,item->>'name',quantity,case when p_new_status='refunded' then 'Rückerstattung ' else 'Stornierung ' end||target_order.order_number,target_order.id,actor.id,actor.full_name);
    end if;
  end loop;

  update public.orders set status=p_new_status,cancellation_reason=p_reason where id=p_order_id returning * into target_order;
  insert into public.audit_logs(employee_id,employee_name,action,entity_type,entity_id,entity_name,details)
  values(actor.id,actor.full_name,'order.'||p_new_status,'order',target_order.id::text,target_order.order_number,p_reason);
  return target_order;
end;
$$;

create or replace function public.complete_first_login()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
begin
  select * into actor from public.profiles where id = (select auth.uid()) for update;
  if not found then raise exception 'Mitarbeiterkonto nicht gefunden.'; end if;
  if actor.active = false then raise exception 'Dieses Mitarbeiterkonto ist deaktiviert.'; end if;

  update public.profiles
  set must_change_password = false
  where id = actor.id
  returning * into actor;

  insert into public.audit_logs(employee_id, employee_name, action, entity_type, entity_id, entity_name, details)
  values(
    actor.id,
    actor.full_name,
    'employee.first_password_set',
    'profile',
    actor.id::text,
    actor.full_name,
    'Startpasswort wurde ersetzt.'
  );

  return actor;
end;
$$;

revoke all on function public.create_order(jsonb) from public, anon;
revoke all on function public.change_stock(uuid,numeric,text) from public, anon;
revoke all on function public.cancel_order(uuid,text,text) from public, anon;
revoke all on function public.complete_first_login() from public, anon;
grant execute on function public.create_order(jsonb) to authenticated;
grant execute on function public.change_stock(uuid,numeric,text) to authenticated;
grant execute on function public.cancel_order(uuid,text,text) to authenticated;
grant execute on function public.complete_first_login() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.ingredients enable row level security;
alter table public.menus enable row level security;
alter table public.menu_ingredients enable row level security;
alter table public.organizations enable row level security;
alter table public.orders enable row level security;
alter table public.stock_movements enable row level security;
alter table public.notices enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_change_password on public.profiles;
drop policy if exists settings_select on public.settings;
drop policy if exists settings_insert on public.settings;
drop policy if exists settings_update on public.settings;
drop policy if exists ingredients_select on public.ingredients;
drop policy if exists ingredients_insert on public.ingredients;
drop policy if exists ingredients_update on public.ingredients;
drop policy if exists ingredients_delete on public.ingredients;
drop policy if exists menus_select on public.menus;
drop policy if exists menus_insert on public.menus;
drop policy if exists menus_update on public.menus;
drop policy if exists menus_delete on public.menus;
drop policy if exists recipes_select on public.menu_ingredients;
drop policy if exists recipes_insert on public.menu_ingredients;
drop policy if exists recipes_update on public.menu_ingredients;
drop policy if exists recipes_delete on public.menu_ingredients;
drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_insert on public.organizations;
drop policy if exists organizations_update on public.organizations;
drop policy if exists organizations_delete on public.organizations;
drop policy if exists orders_select on public.orders;
drop policy if exists stock_movements_select on public.stock_movements;
drop policy if exists notices_select on public.notices;
drop policy if exists notices_insert on public.notices;
drop policy if exists notices_update on public.notices;
drop policy if exists notices_delete on public.notices;
drop policy if exists audit_select on public.audit_logs;

create policy profiles_select on public.profiles for select to authenticated using (id=(select auth.uid()) or (select private.can_use_app()));

create policy settings_select on public.settings for select to authenticated using ((select private.can_use_app()));
create policy settings_insert on public.settings for insert to authenticated with check ((select private.has_permission('settings.manage')));
create policy settings_update on public.settings for update to authenticated using ((select private.has_permission('settings.manage'))) with check ((select private.has_permission('settings.manage')));

create policy ingredients_select on public.ingredients for select to authenticated using ((select private.can_use_app()));
create policy ingredients_insert on public.ingredients for insert to authenticated with check ((select private.has_permission('ingredients.manage')));
create policy ingredients_update on public.ingredients for update to authenticated using ((select private.has_permission('ingredients.manage'))) with check ((select private.has_permission('ingredients.manage')));
create policy ingredients_delete on public.ingredients for delete to authenticated using ((select private.has_permission('ingredients.manage')));

create policy menus_select on public.menus for select to authenticated using ((select private.can_use_app()));
create policy menus_insert on public.menus for insert to authenticated with check ((select private.has_permission('menus.manage')));
create policy menus_update on public.menus for update to authenticated using ((select private.has_permission('menus.manage'))) with check ((select private.has_permission('menus.manage')));
create policy menus_delete on public.menus for delete to authenticated using ((select private.has_permission('menus.manage')));

create policy recipes_select on public.menu_ingredients for select to authenticated using ((select private.can_use_app()));
create policy recipes_insert on public.menu_ingredients for insert to authenticated with check ((select private.has_permission('menus.manage')));
create policy recipes_update on public.menu_ingredients for update to authenticated using ((select private.has_permission('menus.manage'))) with check ((select private.has_permission('menus.manage')));
create policy recipes_delete on public.menu_ingredients for delete to authenticated using ((select private.has_permission('menus.manage')));

create policy organizations_select on public.organizations for select to authenticated using ((select private.can_use_app()));
create policy organizations_insert on public.organizations for insert to authenticated with check ((select private.has_permission('organizations.manage')));
create policy organizations_update on public.organizations for update to authenticated using ((select private.has_permission('organizations.manage'))) with check ((select private.has_permission('organizations.manage')));
create policy organizations_delete on public.organizations for delete to authenticated using ((select private.has_permission('organizations.manage')));

create policy orders_select on public.orders for select to authenticated using ((select private.has_permission('orders.view')));
create policy stock_movements_select on public.stock_movements for select to authenticated using ((select private.has_permission('stock.manage')) or (select private.has_permission('audit.view')));

create policy notices_select on public.notices for select to authenticated using ((select private.can_use_app()));
create policy notices_insert on public.notices for insert to authenticated with check ((select private.has_permission('notices.manage')) and author_id=(select auth.uid()));
create policy notices_update on public.notices for update to authenticated using ((select private.has_permission('notices.manage'))) with check ((select private.has_permission('notices.manage')));
create policy notices_delete on public.notices for delete to authenticated using ((select private.has_permission('notices.manage')));

create policy audit_select on public.audit_logs for select to authenticated using ((select private.has_permission('audit.view')));

-- Least-privilege table grants. RPCs perform order and stock writes.
revoke all on public.profiles, public.settings, public.ingredients, public.menus, public.menu_ingredients,
  public.organizations, public.orders, public.stock_movements, public.notices, public.audit_logs
  from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles, public.settings, public.ingredients, public.menus, public.menu_ingredients, public.organizations, public.orders, public.stock_movements, public.notices, public.audit_logs to authenticated;
grant insert, delete on public.ingredients, public.menus, public.menu_ingredients, public.organizations, public.notices to authenticated;
grant insert, update on public.settings to authenticated;
revoke update (must_change_password) on public.profiles from authenticated;
grant update (name,category,purchase_price,sale_price,tax_rate,organization_discount,min_stock,unit,consumable,producible,active,updated_at) on public.ingredients to authenticated;
grant update on public.menus, public.menu_ingredients, public.organizations, public.notices to authenticated;

-- ---------------------------------------------------------------------------
-- Product image storage
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_insert on storage.objects;
drop policy if exists product_images_update on storage.objects;
drop policy if exists product_images_delete on storage.objects;

create policy product_images_public_read on storage.objects for select to public using (bucket_id='product-images');
create policy product_images_insert on storage.objects for insert to authenticated with check (bucket_id='product-images' and (select private.has_permission('menus.manage')));
create policy product_images_update on storage.objects for update to authenticated using (bucket_id='product-images' and (select private.has_permission('menus.manage'))) with check (bucket_id='product-images' and (select private.has_permission('menus.manage')));
create policy product_images_delete on storage.objects for delete to authenticated using (bucket_id='product-images' and (select private.has_permission('menus.manage')));

-- ---------------------------------------------------------------------------
-- Bootstrap owner
-- ---------------------------------------------------------------------------
-- 1. Create the first user manually in Authentication > Users.
-- 2. Then run the following statement with the actual auth user UUID:
--
-- insert into public.profiles(id,username,email,full_name,role,active,must_change_password)
-- values('AUTH-USER-UUID','inhaber','inhaber@afterhours.local','André Kasper','owner',true,true)
-- on conflict(id) do update set role='owner',active=true;
