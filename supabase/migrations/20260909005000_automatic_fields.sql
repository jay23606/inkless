alter table public.ink_document_versions
  add column field_plan jsonb not null default '[]'::jsonb,
  add constraint ink_field_plan_array check (jsonb_typeof(field_plan)='array');

alter table public.ink_signatures
  add column applied_fields jsonb not null default '[]'::jsonb,
  add constraint ink_applied_fields_array check (jsonb_typeof(applied_fields)='array');
