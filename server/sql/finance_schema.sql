-- LifeOS Finance module — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Access model: these tables are accessed ONLY through the LifeOS Express
-- backend (server/src/finance.js), which authenticates the user via the
-- app's own JWT and then talks to Supabase using the service-role key.
-- The service role bypasses Row Level Security entirely, so RLS is enabled
-- here with NO policies defined — that's deliberate: it means the anon/
-- authenticated Supabase roles have zero access even by accident (e.g. if
-- the anon key were ever mistakenly shipped in the app). Every real access
-- path is enforced in application code (server/src/finance.js), which scopes
-- every query to req.user.id from the verified JWT.

create extension if not exists "pgcrypto";

-- === accounts ===============================================================
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,                -- matches the id from the LifeOS auth server's users table
  name text not null,
  type text not null check (type in ('general', 'cash', 'investment', 'credit')),
  currency text not null default 'USD',
  current_balance numeric not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_accounts_user_id on accounts(user_id);

alter table accounts enable row level security;

-- === categories ==============================================================
-- Shared across all users (like the app's existing static category lists) —
-- no user_id column. If you want per-user custom categories later, add
-- user_id (nullable = built-in, non-null = user-created) and filter for it.
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null default 'pricetag',
  color text not null default '#6C63FF',
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

-- === transactions ============================================================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  note text,
  to_account_id uuid references accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  -- transfers move between two of the user's own accounts; category doesn't
  -- apply to a transfer (it isn't income or expense for analytics purposes)
  constraint transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (type <> 'transfer' and to_account_id is null)
  )
);
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_transactions_date on transactions(date);

alter table transactions enable row level security;

-- === balance recalculation ===================================================
-- Applies a transaction's effect on account balance(s): expense/transfer-out
-- subtract from account_id, income adds to account_id, transfer-in adds to
-- to_account_id. Transfers never touch global income/expense totals — those
-- are computed at query time as SUM(amount) WHERE type IN ('income','expense'),
-- which naturally excludes transfers.
create or replace function apply_transaction_effect(
  p_account_id uuid, p_to_account_id uuid, p_type text, p_amount numeric, p_sign integer
) returns void as $$
begin
  if p_type = 'income' then
    update accounts set current_balance = current_balance + (p_amount * p_sign), updated_at = now() where id = p_account_id;
  elsif p_type = 'expense' then
    update accounts set current_balance = current_balance - (p_amount * p_sign), updated_at = now() where id = p_account_id;
  elsif p_type = 'transfer' then
    update accounts set current_balance = current_balance - (p_amount * p_sign), updated_at = now() where id = p_account_id;
    update accounts set current_balance = current_balance + (p_amount * p_sign), updated_at = now() where id = p_to_account_id;
  end if;
end;
$$ language plpgsql;

create or replace function trg_transactions_balance() returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    perform apply_transaction_effect(NEW.account_id, NEW.to_account_id, NEW.type, NEW.amount, 1);
    return NEW;
  elsif TG_OP = 'UPDATE' then
    -- reverse the old effect, then apply the new one — handles edits that
    -- change amount, type, or which account(s) were involved
    perform apply_transaction_effect(OLD.account_id, OLD.to_account_id, OLD.type, OLD.amount, -1);
    perform apply_transaction_effect(NEW.account_id, NEW.to_account_id, NEW.type, NEW.amount, 1);
    return NEW;
  elsif TG_OP = 'DELETE' then
    perform apply_transaction_effect(OLD.account_id, OLD.to_account_id, OLD.type, OLD.amount, -1);
    return OLD;
  end if;
end;
$$ language plpgsql;

drop trigger if exists transactions_balance_trigger on transactions;
create trigger transactions_balance_trigger
  after insert or update or delete on transactions
  for each row execute function trg_transactions_balance();

-- === seed categories (static content, same "content vs data" split as the
-- rest of the app's built-in category/session/exercise catalogs) ===========
insert into categories (name, type, icon, color)
select * from (values
  ('Groceries', 'expense', 'cart', '#34C759'),
  ('Transport', 'expense', 'car', '#3D8BFF'),
  ('Housing', 'expense', 'home', '#FF9500'),
  ('Shopping', 'expense', 'bag', '#FF2D55'),
  ('Health', 'expense', 'medkit', '#00BCD4'),
  ('Entertainment', 'expense', 'game-controller', '#AF52DE'),
  ('Other', 'expense', 'ellipsis-horizontal', '#8E8E93'),
  ('Salary', 'income', 'cash', '#34C759'),
  ('Freelance', 'income', 'briefcase', '#3D8BFF'),
  ('Investment', 'income', 'trending-up', '#F5A623'),
  ('Other', 'income', 'ellipsis-horizontal', '#8E8E93')
) as seed(name, type, icon, color)
where not exists (select 1 from categories);
