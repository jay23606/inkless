alter table public.il_document_versions
  add column field_plan jsonb not null default '[]'::jsonb,
  add constraint il_field_plan_array check (jsonb_typeof(field_plan)='array');

alter table public.il_signatures
  add column applied_fields jsonb not null default '[]'::jsonb,
  add constraint il_applied_fields_array check (jsonb_typeof(applied_fields)='array');
