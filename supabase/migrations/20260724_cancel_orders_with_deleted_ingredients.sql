alter table public.stock_movements
alter column ingredient_id drop not null;

alter table public.stock_movements
drop constraint if exists stock_movements_ingredient_id_fkey;

alter table public.stock_movements
add constraint stock_movements_ingredient_id_fkey
foreign key (ingredient_id)
references public.ingredients(id)
on delete set null;

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
  quantity numeric(14,3);
  movement_ingredient_id uuid;
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
        movement_ingredient_id := nullif(usage_row.value->>'ingredient_id','')::uuid;

        update public.ingredients
        set stock=stock+quantity
        where id=movement_ingredient_id;

        if not found then
          movement_ingredient_id := null;
        end if;

        insert into public.stock_movements(ingredient_id,ingredient_name,quantity,reason,order_id,employee_id,employee_name)
        values(movement_ingredient_id,usage_row.value->>'name',quantity,case when p_new_status='refunded' then 'Rückerstattung ' else 'Stornierung ' end||target_order.order_number,target_order.id,actor.id,actor.full_name);
      end loop;
    elsif item->>'type'='ingredient' then
      quantity := (item->>'quantity')::numeric;
      movement_ingredient_id := nullif(item->>'reference_id','')::uuid;

      update public.ingredients
      set stock=stock+quantity
      where id=movement_ingredient_id;

      if not found then
        movement_ingredient_id := null;
      end if;

      insert into public.stock_movements(ingredient_id,ingredient_name,quantity,reason,order_id,employee_id,employee_name)
      values(movement_ingredient_id,item->>'name',quantity,case when p_new_status='refunded' then 'Rückerstattung ' else 'Stornierung ' end||target_order.order_number,target_order.id,actor.id,actor.full_name);
    end if;
  end loop;

  update public.orders set status=p_new_status,cancellation_reason=p_reason where id=p_order_id returning * into target_order;

  insert into public.audit_logs(employee_id,employee_name,action,entity_type,entity_id,entity_name,details)
  values(actor.id,actor.full_name,'order.'||p_new_status,'order',target_order.id::text,target_order.order_number,p_reason);

  return target_order;
end;
$$;

grant execute on function public.cancel_order(uuid,text,text) to authenticated;
