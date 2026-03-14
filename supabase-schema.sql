-- ============================================================
-- Vastrika AI — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text not null default '',
  body_type text not null default 'rectangle',
  skin_tone text not null default 'Medium',
  model_gender text not null default 'neutral',
  face_image_url text,
  body_image_url text,
  notif_outfits boolean not null default true,
  notif_gaps boolean not null default true,
  personalization boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Closet items table
create table if not exists public.closet_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null,
  color text not null default '',
  tags text[] not null default '{}',
  purchase_type text not null default 'new',
  price numeric,
  image_url text not null default '',
  gender text not null default 'unisex',
  brand text,
  material text,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3. Stylist history table
create table if not exists public.stylist_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  occasion text not null,
  prompt text,
  result_items jsonb not null default '[]',
  tip text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security (RLS) — users can only access their own data
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.closet_items enable row level security;
alter table public.stylist_history enable row level security;

-- Profiles: users can read/update only their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Closet items: users can CRUD only their own items
create policy "Users can view own closet items"
  on public.closet_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own closet items"
  on public.closet_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own closet items"
  on public.closet_items for update
  using (auth.uid() = user_id);

create policy "Users can delete own closet items"
  on public.closet_items for delete
  using (auth.uid() = user_id);

-- Stylist history: users can CRUD only their own history
create policy "Users can view own stylist history"
  on public.stylist_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own stylist history"
  on public.stylist_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own stylist history"
  on public.stylist_history for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Storage buckets for images
-- ============================================================

-- Create storage buckets (run these one at a time if needed)
insert into storage.buckets (id, name, public) values ('clothing-images', 'clothing-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

-- Storage policies: users can upload to their own folder
create policy "Users can upload clothing images"
  on storage.objects for insert
  with check (
    bucket_id = 'clothing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view clothing images"
  on storage.objects for select
  using (bucket_id = 'clothing-images');

create policy "Users can delete own clothing images"
  on storage.objects for delete
  using (
    bucket_id = 'clothing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload profile images"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view profile images"
  on storage.objects for select
  using (bucket_id = 'profile-images');

create policy "Users can delete own profile images"
  on storage.objects for delete
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- Auto-create profile on signup (trigger)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Indexes for performance
-- ============================================================
create index if not exists idx_closet_items_user_id on public.closet_items(user_id);
create index if not exists idx_closet_items_category on public.closet_items(category);
create index if not exists idx_stylist_history_user_id on public.stylist_history(user_id);
