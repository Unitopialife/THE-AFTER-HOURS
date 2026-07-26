create table if not exists public.tip_payouts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete set null,
  employee_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid references public.profiles(id) on delete set null,
  paid_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_tip_payouts_employee
on public.tip_payouts(employee_id, created_at desc);

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
  entity_name := coalesce(row_data->>'name', row_data->>'full_name', row_data->>'employee_name', row_data->>'title', row_data->>'key', '');

  insert into public.audit_logs(employee_id, employee_name, action, entity_type, entity_id, entity_name, details, metadata)
  values (actor_id, actor_name, lower(tg_table_name || '.' || tg_op), tg_table_name, entity_id, entity_name,
          case tg_op when 'INSERT' then 'Datensatz wurde erstellt.' when 'UPDATE' then 'Datensatz wurde bearbeitet.' else 'Datensatz wurde gelöscht.' end,
          jsonb_build_object('operation', tg_op));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.audit_table_change() from public, anon, authenticated;

drop trigger if exists audit_tip_payouts on public.tip_payouts;
create trigger audit_tip_payouts
after insert on public.tip_payouts
for each row execute function public.audit_table_change();

alter table public.tip_payouts enable row level security;

drop policy if exists tip_payouts_select on public.tip_payouts;
drop policy if exists tip_payouts_insert on public.tip_payouts;

create policy tip_payouts_select
on public.tip_payouts
for select
to authenticated
using ((select private.can_use_app()));

create policy tip_payouts_insert
on public.tip_payouts
for insert
to authenticated
with check ((select private.has_permission('employees.manage')) and paid_by=(select auth.uid()));

revoke all on public.tip_payouts from anon, authenticated;
grant select, insert on public.tip_payouts to authenticated;
