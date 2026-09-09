alter table public.il_signatures
  add column signer_user_id uuid references auth.users(id),
  add column identity_method text not null default 'supabase_email'
    check (identity_method='supabase_email');

create index il_signatures_signer_user_idx on public.il_signatures(signer_user_id);
