-- 1. Create Profiles table (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text default 'Staff',
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Minimal RLS: Users can only see and edit their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Trigger to create profile on signup (Essential data only)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Minimal RLS for other tables (Essential only)
-- Example for medicines: Authenticated users can read, only Admins (or specific logic) can write
-- For now, keeping it simple as requested: Authenticated users have full access to their business data
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.medicines enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.expenses enable row level security;
alter table public.staff enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;
alter table public.returns enable row level security;
alter table public.dues enable row level security;
alter table public.supplier_payments enable row level security;

create policy "Authenticated users full access" on public.categories for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.suppliers for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.medicines for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.customers for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.invoices for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.invoice_items for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.purchases for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.purchase_items for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.expenses for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.staff for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.activity_logs for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.settings for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.returns for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.dues for all using (auth.role() = 'authenticated');
create policy "Authenticated users full access" on public.supplier_payments for all using (auth.role() = 'authenticated');
