-- ==========================================
-- SUPABASE AUTH & PROFILES SETUP (IDEMPOTENT)
-- ==========================================
-- Copy and paste this into your Supabase SQL Editor
-- and click "Run" to set up your authentication system.

-- 1. Create a table for public profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone default now(),
  full_name text,
  role text default 'Staff',
  status text default 'active',
  email text,

  constraint full_name_length check (char_length(full_name) >= 3)
);

-- 2. Set up Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. Create policies (Drop first to avoid "already exists" errors)
drop policy if exists "Profiles are viewable by authenticated users." on public.profiles;
create policy "Profiles are viewable by authenticated users." on public.profiles
  for select to authenticated using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- 4. Create a function to handle new user signups
-- This function will automatically create a profile record
-- whenever a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    new.email, 
    'Staff', 
    'active'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 5. Create a trigger to call the function on signup
-- Drop if exists to avoid errors on re-run
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- DONE! Your auth system is now ready.
-- ==========================================
