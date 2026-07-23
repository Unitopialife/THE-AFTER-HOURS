do $$
declare
  constraint_row record;
begin
  alter table public.stock_movements alter column ingredient_id drop not null;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.menu_ingredients'::regclass
      and contype = 'f'
      and conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.menu_ingredients'::regclass
            and attname = 'ingredient_id'
        )
      ]
  loop
    execute format('alter table public.menu_ingredients drop constraint %I', constraint_row.conname);
  end loop;

  alter table public.menu_ingredients
    add constraint menu_ingredients_ingredient_id_fkey
    foreign key (ingredient_id) references public.ingredients(id) on delete cascade;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and contype = 'f'
      and conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.stock_movements'::regclass
            and attname = 'ingredient_id'
        )
      ]
  loop
    execute format('alter table public.stock_movements drop constraint %I', constraint_row.conname);
  end loop;

  alter table public.stock_movements
    add constraint stock_movements_ingredient_id_fkey
    foreign key (ingredient_id) references public.ingredients(id) on delete set null;
end $$;
