alter table public.products
  add column display_name text;

update public.products
set display_name = canonical_name
where display_name is null;

create or replace function public.set_product_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.canonical_name := trim(regexp_replace(new.canonical_name, '\s+', ' ', 'g'));
  new.display_name := trim(regexp_replace(coalesce(new.display_name, new.canonical_name), '\s+', ' ', 'g'));
  new.brand_name := nullif(trim(regexp_replace(coalesce(new.brand_name, ''), '\s+', ' ', 'g')), '');
  new.search_text_normalized := public.normalize_product_search_text(
    concat_ws(' ', new.canonical_name, nullif(new.display_name, new.canonical_name)),
    new.brand_name
  );
  return new;
end;
$$;

drop trigger products_set_search_text on public.products;

create trigger products_set_search_text
before insert or update of canonical_name, display_name, brand_name
on public.products
for each row execute function public.set_product_search_text();

update public.products
set display_name = display_name;

alter table public.products
  alter column display_name set not null,
  add constraint products_display_name_valid check (
    trim(display_name) <> '' and char_length(display_name) <= 200
  );
