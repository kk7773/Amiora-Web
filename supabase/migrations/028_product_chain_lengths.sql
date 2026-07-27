alter table public.products
  add column if not exists chain_lengths jsonb not null default '[]'::jsonb;

