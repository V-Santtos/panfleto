create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.is_valid_gtin(value text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  digit_index integer;
  position_from_right integer := 0;
  weighted_sum integer := 0;
  expected_digit integer;
begin
  if value !~ '^(\d{8}|\d{12}|\d{13}|\d{14})$' then
    return false;
  end if;

  expected_digit := substring(value from char_length(value) for 1)::integer;
  for digit_index in reverse char_length(value) - 1..1 loop
    weighted_sum := weighted_sum
      + substring(value from digit_index for 1)::integer
      * case when position_from_right % 2 = 0 then 3 else 1 end;
    position_from_right := position_from_right + 1;
  end loop;

  return (10 - (weighted_sum % 10)) % 10 = expected_digit;
end;
$$;

create or replace function public.normalize_product_search_text(name_value text, brand_value text default null)
returns text
language sql
stable
set search_path = ''
as $$
  select trim(
    regexp_replace(
      lower(extensions.unaccent(concat_ws(' ', nullif(trim(name_value), ''), nullif(trim(brand_value), '')))),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create table public.assets (
  id uuid primary key default extensions.gen_random_uuid(),
  kind text not null check (kind in ('product_original', 'product_processed', 'logo', 'template_background', 'font')),
  bucket text not null default 'catalog-assets' check (bucket = 'catalog-assets'),
  object_path text not null check (
    object_path <> ''
    and object_path !~ '(^|/)\.\.(/|$)'
    and object_path !~ '^/'
    and object_path !~ '[\\]'
  ),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 12582912),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  width_px integer,
  height_px integer,
  created_at timestamptz not null default statement_timestamp(),
  constraint assets_bucket_path_unique unique (bucket, object_path),
  constraint assets_mime_matches_kind check (
    (kind = 'font' and mime_type in ('font/ttf', 'font/otf', 'application/x-font-ttf', 'application/x-font-opentype'))
    or
    (kind <> 'font' and mime_type in ('image/png', 'image/jpeg', 'image/webp'))
  ),
  constraint assets_dimensions_match_kind check (
    (kind = 'font' and width_px is null and height_px is null)
    or
    (kind <> 'font' and width_px > 0 and height_px > 0)
  )
);

create index assets_sha256_idx on public.assets (sha256);

create table public.store_themes (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (trim(name) <> ''),
  store_name text not null check (trim(store_name) <> ''),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  logo_asset_id uuid references public.assets(id) on delete restrict,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text not null check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  display_font_family text not null check (trim(display_font_family) <> ''),
  display_font_asset_id uuid references public.assets(id) on delete restrict,
  body_font_family text not null check (trim(body_font_family) <> ''),
  body_font_asset_id uuid references public.assets(id) on delete restrict,
  price_font_family text not null check (trim(price_font_family) <> ''),
  price_font_asset_id uuid references public.assets(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint store_themes_slug_version_unique unique (slug, version),
  constraint store_themes_active_requires_assets check (
    status <> 'active'
    or (logo_asset_id is not null and display_font_asset_id is not null and body_font_asset_id is not null and price_font_asset_id is not null)
  )
);

create unique index store_themes_one_active_idx
  on public.store_themes ((status))
  where status = 'active';

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  gtin text,
  canonical_name text not null check (trim(canonical_name) <> '' and char_length(canonical_name) <= 200),
  brand_name text check (brand_name is null or char_length(brand_name) <= 120),
  default_quantity numeric(12, 3) not null check (default_quantity > 0 and default_quantity <= 9999),
  default_unit text not null check (default_unit in ('g', 'kg', 'ml', 'L', 'unidade')),
  registration_method text not null check (registration_method in ('gtin_lookup', 'manual')),
  metadata_origin text not null check (metadata_origin in ('openfoodfacts', 'cosmos', 'curadoria_interna', 'manual')),
  search_text_normalized text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint products_gtin_valid check (gtin is null or public.is_valid_gtin(gtin)),
  constraint products_gtin_lookup_requires_code check (registration_method <> 'gtin_lookup' or gtin is not null),
  constraint products_gtin_unique unique (gtin)
);

create index products_active_search_trgm_idx
  on public.products using gin (search_text_normalized extensions.gin_trgm_ops)
  where status = 'active';

create index products_active_gtin_idx
  on public.products (gtin)
  where status = 'active' and gtin is not null;

create table public.product_images (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  source_origin text not null check (source_origin in ('openfoodfacts', 'cosmos', 'gs1', 'curadoria_interna', 'upload_usuario')),
  source_url text check (source_url is null or source_url ~ '^https://'),
  original_asset_id uuid references public.assets(id) on delete restrict,
  processed_asset_id uuid not null unique references public.assets(id) on delete restrict,
  processing_method text not null check (processing_method in ('alpha_preserved', 'deterministic_cutout', 'kie')),
  pipeline_version text not null check (trim(pipeline_version) <> '' and char_length(pipeline_version) <= 80),
  source_width_px integer not null check (source_width_px > 0),
  source_height_px integer not null check (source_height_px > 0),
  visible_left_px integer not null check (visible_left_px >= 0),
  visible_top_px integer not null check (visible_top_px >= 0),
  visible_width_px integer not null check (visible_width_px > 0),
  visible_height_px integer not null check (visible_height_px > 0),
  has_intrinsic_contact_shadow boolean not null default false,
  is_primary boolean not null default false,
  association_status text not null default 'candidate' check (association_status in ('candidate', 'approved', 'rejected', 'retired')),
  usage_rights_status text not null default 'unknown' check (usage_rights_status in ('unknown', 'approved', 'restricted')),
  rights_note text,
  approved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint product_images_visible_bounds_x check (visible_left_px + visible_width_px <= source_width_px),
  constraint product_images_visible_bounds_y check (visible_top_px + visible_height_px <= source_height_px),
  constraint product_images_primary_is_approved check (not is_primary or association_status = 'approved'),
  constraint product_images_approved_has_timestamp check (association_status <> 'approved' or approved_at is not null)
);

create unique index product_images_one_primary_approved_idx
  on public.product_images (product_id)
  where is_primary and association_status = 'approved';

create index product_images_product_idx on public.product_images (product_id, association_status);

create table public.artwork_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  theme_id uuid not null references public.store_themes(id) on delete restrict,
  channel text not null check (channel in ('story', 'feed')),
  product_count smallint not null check (product_count in (1, 4, 8)),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  renderer_key text not null check (renderer_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  width_px integer not null check (width_px > 0),
  height_px integer not null check (height_px > 0),
  background_asset_id uuid not null references public.assets(id) on delete restrict,
  layout_schema_version integer not null check (layout_schema_version > 0),
  layout_config jsonb not null check (jsonb_typeof(layout_config) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  constraint artwork_templates_version_unique unique (theme_id, channel, product_count, version),
  constraint artwork_templates_story_dimensions check (
    channel <> 'story' or (width_px = 1080 and height_px = 1920)
  )
);

create unique index artwork_templates_one_active_idx
  on public.artwork_templates (theme_id, channel, product_count)
  where status = 'active';

create table public.campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  theme_id uuid not null references public.store_themes(id) on delete restrict,
  title text not null default '' check (char_length(title) <= 160),
  starts_on date,
  ends_on date,
  note text check (note is null or char_length(note) <= 1000),
  item_count smallint not null check (item_count in (1, 4, 8)),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'exported', 'archived')),
  revision bigint not null default 1 check (revision > 0),
  reviewed_at timestamptz,
  last_exported_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint campaigns_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint campaigns_review_timestamp check ((status = 'draft') or reviewed_at is not null)
);

create index campaigns_status_updated_idx on public.campaigns (status, updated_at desc);

create table public.campaign_items (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  product_id uuid not null references public.products(id) on delete restrict,
  product_image_id uuid not null references public.product_images(id) on delete restrict,
  gtin_snapshot text,
  canonical_name_snapshot text not null check (trim(canonical_name_snapshot) <> ''),
  brand_name_snapshot text,
  display_name text not null check (trim(display_name) <> '' and char_length(display_name) <= 200),
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 9999),
  unit text not null check (unit in ('g', 'kg', 'ml', 'L', 'unidade')),
  promotional_price_cents integer not null check (promotional_price_cents > 0),
  previous_price_cents integer,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint campaign_items_position_unique unique (campaign_id, position),
  constraint campaign_items_product_unique unique (campaign_id, product_id),
  constraint campaign_items_previous_price check (
    previous_price_cents is null or previous_price_cents > promotional_price_cents
  ),
  constraint campaign_items_gtin_snapshot_valid check (gtin_snapshot is null or public.is_valid_gtin(gtin_snapshot))
);

create index campaign_items_campaign_idx on public.campaign_items (campaign_id, position);

create table public.campaign_exports (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  campaign_revision bigint not null check (campaign_revision > 0),
  template_id uuid not null references public.artwork_templates(id) on delete restrict,
  channel text not null check (channel in ('story', 'feed')),
  file_format text not null check (file_format in ('png', 'pdf')),
  file_name text not null check (trim(file_name) <> '' and char_length(file_name) <= 240),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null unique,
  render_snapshot jsonb not null check (jsonb_typeof(render_snapshot) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  constraint campaign_exports_pdf_story_only check (file_format <> 'pdf' or channel = 'story')
);

create index campaign_exports_campaign_created_idx on public.campaign_exports (campaign_id, created_at desc);

create table public.integration_daily_usage (
  provider text not null check (provider in ('cosmos')),
  usage_date date not null,
  used_count integer not null default 0,
  daily_limit integer not null default 25 check (daily_limit > 0),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (provider, usage_date),
  constraint integration_daily_usage_count check (used_count between 0 and daily_limit)
);

create or replace function public.set_product_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.canonical_name := trim(regexp_replace(new.canonical_name, '\s+', ' ', 'g'));
  new.brand_name := nullif(trim(regexp_replace(coalesce(new.brand_name, ''), '\s+', ' ', 'g')), '');
  new.search_text_normalized := public.normalize_product_search_text(new.canonical_name, new.brand_name);
  return new;
end;
$$;

create trigger products_set_search_text
before insert or update of canonical_name, brand_name
on public.products
for each row execute function public.set_product_search_text();

create trigger store_themes_set_updated_at
before update on public.store_themes
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create trigger campaign_items_set_updated_at
before update on public.campaign_items
for each row execute function public.set_updated_at();

create trigger integration_usage_set_updated_at
before update on public.integration_daily_usage
for each row execute function public.set_updated_at();

create or replace function public.validate_campaign_item_image()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  image_product_id uuid;
  image_status text;
begin
  select product_id, association_status
  into image_product_id, image_status
  from public.product_images
  where id = new.product_image_id;

  if image_product_id is null then
    raise exception 'A imagem selecionada não existe.' using errcode = '23503';
  end if;
  if image_product_id <> new.product_id then
    raise exception 'A imagem selecionada não pertence ao produto.' using errcode = '23514';
  end if;
  if image_status <> 'approved' then
    raise exception 'A imagem selecionada ainda não foi aprovada.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger campaign_items_validate_image
before insert or update of product_id, product_image_id
on public.campaign_items
for each row execute function public.validate_campaign_item_image();

create or replace function public.activate_product(product_id_value uuid)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  activated_product public.products;
begin
  if not exists (
    select 1
    from public.product_images
    where product_id = product_id_value
      and association_status = 'approved'
      and is_primary
  ) then
    raise exception 'O produto precisa de uma imagem primária aprovada antes de ser ativado.' using errcode = '23514';
  end if;

  update public.products
  set status = 'active'
  where id = product_id_value
  returning * into activated_product;

  if activated_product.id is null then
    raise exception 'Produto não encontrado.' using errcode = 'P0002';
  end if;
  return activated_product;
end;
$$;

create or replace function public.search_active_products(query_value text, result_limit integer default 12)
returns setof public.products
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select public.normalize_product_search_text(query_value, null) as query
  )
  select product.*
  from public.products product
  cross join normalized
  where product.status = 'active'
    and char_length(normalized.query) >= 2
    and (
      product.search_text_normalized like '%' || normalized.query || '%'
      or extensions.similarity(product.search_text_normalized, normalized.query) >= 0.3
    )
  order by
    (public.normalize_product_search_text(product.canonical_name, null) = normalized.query) desc,
    (product.search_text_normalized like normalized.query || '%') desc,
    extensions.similarity(product.search_text_normalized, normalized.query) desc,
    product.canonical_name asc,
    product.id asc
  limit least(greatest(coalesce(result_limit, 12), 1), 12);
$$;

create or replace function public.save_campaign_draft(payload jsonb, expected_revision bigint default null)
returns table (campaign_id uuid, revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_campaign_id uuid;
  current_revision bigint;
  next_revision bigint;
  payload_item jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'A campanha precisa ser um objeto JSON.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(payload -> 'items', '[]'::jsonb)) <> 'array' then
    raise exception 'Os itens da campanha precisam formar uma lista.' using errcode = '22023';
  end if;

  saved_campaign_id := coalesce(nullif(payload ->> 'id', '')::uuid, extensions.gen_random_uuid());

  select campaigns.revision
  into current_revision
  from public.campaigns
  where campaigns.id = saved_campaign_id
  for update;

  if found then
    if expected_revision is null or expected_revision <> current_revision then
      raise exception 'A campanha foi alterada em outra sessão.' using errcode = '40001';
    end if;
    next_revision := current_revision + 1;
    update public.campaigns
    set
      theme_id = (payload ->> 'theme_id')::uuid,
      title = coalesce(payload ->> 'title', ''),
      starts_on = nullif(payload ->> 'starts_on', '')::date,
      ends_on = nullif(payload ->> 'ends_on', '')::date,
      note = nullif(payload ->> 'note', ''),
      item_count = (payload ->> 'item_count')::smallint,
      status = 'draft',
      revision = next_revision,
      reviewed_at = null
    where id = saved_campaign_id;
    delete from public.campaign_items where campaign_items.campaign_id = saved_campaign_id;
  else
    if expected_revision is not null then
      raise exception 'A campanha informada não existe.' using errcode = 'P0002';
    end if;
    next_revision := 1;
    insert into public.campaigns (
      id, theme_id, title, starts_on, ends_on, note, item_count, status, revision
    ) values (
      saved_campaign_id,
      (payload ->> 'theme_id')::uuid,
      coalesce(payload ->> 'title', ''),
      nullif(payload ->> 'starts_on', '')::date,
      nullif(payload ->> 'ends_on', '')::date,
      nullif(payload ->> 'note', ''),
      (payload ->> 'item_count')::smallint,
      'draft',
      next_revision
    );
  end if;

  for payload_item in select value from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    insert into public.campaign_items (
      campaign_id,
      position,
      product_id,
      product_image_id,
      gtin_snapshot,
      canonical_name_snapshot,
      brand_name_snapshot,
      display_name,
      quantity,
      unit,
      promotional_price_cents,
      previous_price_cents
    ) values (
      saved_campaign_id,
      (payload_item ->> 'position')::smallint,
      (payload_item ->> 'product_id')::uuid,
      (payload_item ->> 'product_image_id')::uuid,
      nullif(payload_item ->> 'gtin_snapshot', ''),
      payload_item ->> 'canonical_name_snapshot',
      nullif(payload_item ->> 'brand_name_snapshot', ''),
      payload_item ->> 'display_name',
      (payload_item ->> 'quantity')::numeric,
      payload_item ->> 'unit',
      (payload_item ->> 'promotional_price_cents')::integer,
      nullif(payload_item ->> 'previous_price_cents', '')::integer
    );
  end loop;

  return query select saved_campaign_id, next_revision;
end;
$$;

create or replace function public.review_campaign(campaign_id_value uuid, expected_revision bigint)
returns table (campaign_id uuid, revision bigint, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_record public.campaigns;
  actual_item_count integer;
  invalid_item_count integer;
begin
  select * into campaign_record
  from public.campaigns
  where id = campaign_id_value
  for update;

  if campaign_record.id is null then
    raise exception 'Campanha não encontrada.' using errcode = 'P0002';
  end if;
  if campaign_record.revision <> expected_revision then
    raise exception 'A campanha foi alterada em outra sessão.' using errcode = '40001';
  end if;
  if trim(campaign_record.title) = '' or campaign_record.starts_on is null or campaign_record.ends_on is null then
    raise exception 'Título e período são obrigatórios antes da revisão.' using errcode = '23514';
  end if;

  select count(*) into actual_item_count
  from public.campaign_items item
  where item.campaign_id = campaign_id_value;
  if actual_item_count <> campaign_record.item_count then
    raise exception 'A quantidade de itens não corresponde ao formato escolhido.' using errcode = '23514';
  end if;

  select count(*) into invalid_item_count
  from public.campaign_items item
  join public.products product on product.id = item.product_id
  join public.product_images image on image.id = item.product_image_id
  where item.campaign_id = campaign_id_value
    and (
      product.status <> 'active'
      or image.product_id <> item.product_id
      or image.association_status <> 'approved'
    );
  if invalid_item_count > 0 then
    raise exception 'Todos os itens precisam de produto e imagem aprovados.' using errcode = '23514';
  end if;

  update public.campaigns
  set status = 'reviewed', revision = public.campaigns.revision + 1, reviewed_at = statement_timestamp()
  where id = campaign_id_value
  returning public.campaigns.id, public.campaigns.revision, public.campaigns.reviewed_at
  into campaign_id, revision, reviewed_at;

  return next;
end;
$$;

create or replace function public.record_campaign_export(
  campaign_id_value uuid,
  campaign_revision_value bigint,
  template_id_value uuid,
  channel_value text,
  file_format_value text,
  file_name_value text,
  content_sha256_value text,
  render_snapshot_value jsonb,
  idempotency_key_value uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  export_id uuid;
  existing_export public.campaign_exports;
  campaign_record public.campaigns;
  template_record public.artwork_templates;
begin
  select * into existing_export
  from public.campaign_exports
  where idempotency_key = idempotency_key_value;
  if existing_export.id is not null then
    if existing_export.campaign_id <> campaign_id_value
      or existing_export.campaign_revision <> campaign_revision_value
      or existing_export.template_id <> template_id_value
      or existing_export.channel <> channel_value
      or existing_export.file_format <> file_format_value
      or existing_export.file_name <> file_name_value
      or existing_export.content_sha256 is distinct from content_sha256_value
      or existing_export.render_snapshot <> render_snapshot_value then
      raise exception 'A chave idempotente já foi usada por outra exportação.' using errcode = '23505';
    end if;
    return existing_export.id;
  end if;

  select * into campaign_record
  from public.campaigns
  where id = campaign_id_value
  for update;
  if campaign_record.id is null then
    raise exception 'Campanha não encontrada.' using errcode = 'P0002';
  end if;
  if campaign_record.status not in ('reviewed', 'exported') or campaign_record.revision <> campaign_revision_value then
    raise exception 'A exportação exige a revisão persistida mais recente.' using errcode = '23514';
  end if;

  select * into template_record
  from public.artwork_templates
  where id = template_id_value;
  if template_record.id is null
    or template_record.status <> 'active'
    or template_record.channel <> channel_value
    or template_record.product_count <> campaign_record.item_count then
    raise exception 'O template não está ativo ou não corresponde à campanha.' using errcode = '23514';
  end if;

  insert into public.campaign_exports (
    campaign_id,
    campaign_revision,
    template_id,
    channel,
    file_format,
    file_name,
    content_sha256,
    idempotency_key,
    render_snapshot
  ) values (
    campaign_id_value,
    campaign_revision_value,
    template_id_value,
    channel_value,
    file_format_value,
    file_name_value,
    content_sha256_value,
    idempotency_key_value,
    render_snapshot_value
  ) returning id into export_id;

  update public.campaigns
  set status = 'exported', last_exported_at = statement_timestamp()
  where id = campaign_id_value;

  return export_id;
end;
$$;

create or replace function public.reserve_integration_usage(provider_value text)
returns table (allowed boolean, usage_date date, used_count integer, daily_limit integer, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  sao_paulo_date date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  usage_record public.integration_daily_usage;
begin
  if provider_value <> 'cosmos' then
    raise exception 'Provedor de cota não reconhecido.' using errcode = '22023';
  end if;

  insert into public.integration_daily_usage (provider, usage_date, used_count, daily_limit)
  values (provider_value, sao_paulo_date, 0, 25)
  on conflict (provider, usage_date) do nothing;

  select * into usage_record
  from public.integration_daily_usage
  where provider = provider_value and integration_daily_usage.usage_date = sao_paulo_date
  for update;

  if usage_record.used_count >= usage_record.daily_limit then
    return query select false, sao_paulo_date, usage_record.used_count, usage_record.daily_limit, 0;
    return;
  end if;

  update public.integration_daily_usage
  set used_count = integration_daily_usage.used_count + 1
  where provider = provider_value and integration_daily_usage.usage_date = sao_paulo_date
  returning * into usage_record;

  return query select true, sao_paulo_date, usage_record.used_count, usage_record.daily_limit, usage_record.daily_limit - usage_record.used_count;
end;
$$;

create or replace function public.get_integration_usage(provider_value text)
returns table (usage_date date, used_count integer, daily_limit integer, remaining integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sao_paulo_date date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  usage_record public.integration_daily_usage;
begin
  if provider_value <> 'cosmos' then
    raise exception 'Provedor de cota não reconhecido.' using errcode = '22023';
  end if;

  select * into usage_record
  from public.integration_daily_usage
  where provider = provider_value and integration_daily_usage.usage_date = sao_paulo_date;

  return query select
    sao_paulo_date,
    coalesce(usage_record.used_count, 0),
    coalesce(usage_record.daily_limit, 25),
    coalesce(usage_record.daily_limit - usage_record.used_count, 25);
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-assets',
  'catalog-assets',
  false,
  12582912,
  array['image/png', 'image/jpeg', 'image/webp', 'font/ttf', 'font/otf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.assets enable row level security;
alter table public.store_themes enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.artwork_templates enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_items enable row level security;
alter table public.campaign_exports enable row level security;
alter table public.integration_daily_usage enable row level security;

revoke all on table public.assets from anon, authenticated;
revoke all on table public.store_themes from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.product_images from anon, authenticated;
revoke all on table public.artwork_templates from anon, authenticated;
revoke all on table public.campaigns from anon, authenticated;
revoke all on table public.campaign_items from anon, authenticated;
revoke all on table public.campaign_exports from anon, authenticated;
revoke all on table public.integration_daily_usage from anon, authenticated;

grant select, insert, update, delete on table public.assets to service_role;
grant select, insert, update, delete on table public.store_themes to service_role;
grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.product_images to service_role;
grant select, insert, update, delete on table public.artwork_templates to service_role;
grant select, insert, update, delete on table public.campaigns to service_role;
grant select, insert, update, delete on table public.campaign_items to service_role;
grant select, insert, update, delete on table public.campaign_exports to service_role;
grant select, insert, update, delete on table public.integration_daily_usage to service_role;

revoke execute on function public.is_valid_gtin(text) from public, anon, authenticated;
revoke execute on function public.normalize_product_search_text(text, text) from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.set_product_search_text() from public, anon, authenticated;
revoke execute on function public.validate_campaign_item_image() from public, anon, authenticated;
revoke execute on function public.activate_product(uuid) from public, anon, authenticated;
revoke execute on function public.search_active_products(text, integer) from public, anon, authenticated;
revoke execute on function public.save_campaign_draft(jsonb, bigint) from public, anon, authenticated;
revoke execute on function public.review_campaign(uuid, bigint) from public, anon, authenticated;
revoke execute on function public.record_campaign_export(uuid, bigint, uuid, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.reserve_integration_usage(text) from public, anon, authenticated;
revoke execute on function public.get_integration_usage(text) from public, anon, authenticated;

grant execute on function public.activate_product(uuid) to service_role;
grant execute on function public.search_active_products(text, integer) to service_role;
grant execute on function public.save_campaign_draft(jsonb, bigint) to service_role;
grant execute on function public.review_campaign(uuid, bigint) to service_role;
grant execute on function public.record_campaign_export(uuid, bigint, uuid, text, text, text, text, jsonb, uuid) to service_role;
grant execute on function public.reserve_integration_usage(text) to service_role;
grant execute on function public.get_integration_usage(text) to service_role;

comment on table public.products is 'Produtos validados; busca por nome retorna somente linhas active.';
comment on table public.artwork_templates is 'Versoes de templates. Feed permanece sem linha ativa ate validacao visual.';
comment on function public.search_active_products(text, integer) is 'Busca exclusivamente o catalogo proprio; nunca consulta fontes externas.';
comment on function public.reserve_integration_usage(text) is 'Reserva atomica da cota diaria do Cosmos no fuso America/Sao_Paulo.';
comment on function public.get_integration_usage(text) is 'Consulta a cota Cosmos do dia sem consumir uma reserva.';
