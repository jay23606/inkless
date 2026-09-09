alter table public.il_profiles
  add column signature_method text not null default 'font' check (signature_method in ('font','draw')),
  add column signature_font text not null default 'newsreader' check (signature_font in ('newsreader','cursive','serif','sans')),
  add column signature_data text;

alter table public.il_signatures
  add column signature_font text check (signature_font is null or signature_font in ('newsreader','cursive','serif','sans'));
