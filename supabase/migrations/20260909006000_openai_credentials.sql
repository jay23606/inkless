create table public.il_openai_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_ciphertext text not null,
  key_iv text not null,
  key_last_four text not null check (char_length(key_last_four)=4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.il_openai_credentials enable row level security;

-- No browser-facing policies: only service-role Edge Functions may access keys.
