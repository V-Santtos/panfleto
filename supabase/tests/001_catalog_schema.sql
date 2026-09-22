begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(39);

select has_table('public', 'assets', 'assets existe');
select has_table('public', 'store_themes', 'store_themes existe');
select has_table('public', 'products', 'products existe');
select has_table('public', 'product_images', 'product_images existe');
select has_table('public', 'artwork_templates', 'artwork_templates existe');
select has_table('public', 'campaigns', 'campaigns existe');
select has_table('public', 'campaign_items', 'campaign_items existe');
select has_table('public', 'campaign_exports', 'campaign_exports existe');
select has_table('public', 'integration_daily_usage', 'integration_daily_usage existe');
select has_column('public', 'products', 'display_name', 'products possui nome exibido');

select ok(public.is_valid_gtin('7891000053508'), 'aceita GTIN-13 valido');
select ok(not public.is_valid_gtin('7891000053509'), 'rejeita digito verificador incorreto');
select is(public.normalize_product_search_text('Leite Itambé', 'Marca X'), 'leite itambe marca x', 'normaliza acentos e caixa');

select throws_ok(
  $$insert into public.products (gtin, canonical_name, default_quantity, default_unit, registration_method, metadata_origin)
    values (null, 'Produto sem codigo', 1, 'unidade', 'gtin_lookup', 'openfoodfacts')$$,
  '23514',
  null,
  'gtin_lookup exige codigo'
);

select lives_ok(
  $$insert into public.products (id, gtin, canonical_name, brand_name, default_quantity, default_unit, registration_method, metadata_origin)
    values ('10000000-0000-0000-0000-000000000001', null, 'Café Manual', 'Marca', 500, 'g', 'manual', 'manual')$$,
  'cadastro manual aceita GTIN ausente'
);

select is(
  (select search_text_normalized from public.products where id = '10000000-0000-0000-0000-000000000001'),
  'cafe manual marca',
  'trigger mantem texto de busca'
);

select is(
  (select display_name from public.products where id = '10000000-0000-0000-0000-000000000001'),
  'Café Manual',
  'nome exibido nasce do nome canonico quando omitido'
);

update public.products
set display_name = 'Café da manhã'
where id = '10000000-0000-0000-0000-000000000001';

select is(
  (select canonical_name from public.products where id = '10000000-0000-0000-0000-000000000001'),
  'Café Manual',
  'atualizar nome exibido preserva nome canonico'
);

select is(
  (select search_text_normalized from public.products where id = '10000000-0000-0000-0000-000000000001'),
  'cafe manual cafe da manha marca',
  'busca inclui nome canonico nome exibido e marca'
);

select is_empty(
  $$select id from public.search_active_products('cafe', 12)$$,
  'produto draft nao aparece por nome'
);

select throws_ok(
  $$select public.activate_product('10000000-0000-0000-0000-000000000001')$$,
  '23514',
  null,
  'produto sem imagem aprovada nao ativa'
);

update public.products
set status = 'active'
where id = '10000000-0000-0000-0000-000000000001';

select results_eq(
  $$select canonical_name from public.search_active_products('manha', 12)$$,
  $$values ('Café Manual'::text)$$,
  'busca parcial encontra produto ativo pelo nome exibido'
);

insert into public.store_themes (
  id,
  slug,
  name,
  store_name,
  version,
  status,
  primary_color,
  secondary_color,
  accent_color,
  background_color,
  text_color,
  display_font_family,
  body_font_family,
  price_font_family
) values (
  '20000000-0000-0000-0000-000000000001',
  'tema-teste',
  'Tema de teste',
  'Mercado de teste',
  1,
  'draft',
  '#111111',
  '#222222',
  '#333333',
  '#FFFFFF',
  '#000000',
  'Komika Axis',
  'Arial',
  'Komika Axis'
);

select throws_ok(
  $$insert into public.campaigns (theme_id, item_count)
    values ('20000000-0000-0000-0000-000000000001', 2)$$,
  '23514',
  null,
  'campanha aceita somente 1 4 ou 8 itens'
);

select has_function('public', 'activate_product', array['uuid'], 'activate_product existe');
select has_function('public', 'search_active_products', array['text', 'integer'], 'search_active_products existe');
select has_function('public', 'save_campaign_draft', array['jsonb', 'bigint'], 'save_campaign_draft existe');
select has_function('public', 'review_campaign', array['uuid', 'bigint'], 'review_campaign existe');
select has_function('public', 'reserve_integration_usage', array['text'], 'reserve_integration_usage existe');
select has_function('public', 'get_integration_usage', array['text'], 'get_integration_usage existe');

select is(
  (select count(*)::integer from storage.buckets where id = 'catalog-assets'),
  1,
  'bucket privado existe'
);

select is(
  (select public from storage.buckets where id = 'catalog-assets'),
  false,
  'bucket nao e publico'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.products'::regclass),
  'RLS habilitado em products'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.campaigns'::regclass),
  'RLS habilitado em campaigns'
);

select ok(
  not has_table_privilege('anon', 'public.products', 'select'),
  'anon nao le products'
);

select ok(
  not has_table_privilege('anon', 'public.products', 'insert'),
  'anon nao grava products'
);

select ok(
  not has_function_privilege('anon', 'public.search_active_products(text, integer)', 'execute'),
  'anon nao executa busca interna'
);

select ok(
  not has_function_privilege('authenticated', 'public.save_campaign_draft(jsonb, bigint)', 'execute'),
  'authenticated nao salva sem servidor local'
);

select is(
  (select count(*)::integer from public.artwork_templates where channel = 'feed'),
  0,
  'Feed inicia sem template'
);

select is(
  (select count(*)::integer from public.products),
  1,
  'teste criou somente o produto manual controlado'
);

select * from finish();
rollback;
