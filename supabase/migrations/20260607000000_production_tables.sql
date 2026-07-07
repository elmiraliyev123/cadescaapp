-- Production tables migration for Users, QR tokens, Menu items, and Check-ins.

CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  university_name text,
  university_domain text,
  student_status text NOT NULL DEFAULT 'not_verified',
  student_menu_access boolean NOT NULL DEFAULT false,
  email_verified boolean NOT NULL DEFAULT false,
  accepted_terms_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AZN',
  category text NOT NULL DEFAULT 'Menu',
  student_menu_eligible boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id text PRIMARY KEY,
  token text UNIQUE NOT NULL,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.student_check_ins (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  restaurant_id text NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  merchant_user_id text NOT NULL REFERENCES public.merchant_accounts(id),
  menu_item_id text REFERENCES public.restaurant_menu_items(id),
  qr_token_id text REFERENCES public.qr_tokens(id),
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS users_email_lower_idx ON public.users (lower(email));
CREATE INDEX IF NOT EXISTS qr_tokens_token_idx ON public.qr_tokens (token);
CREATE INDEX IF NOT EXISTS student_check_ins_user_id_idx ON public.student_check_ins (user_id);
CREATE INDEX IF NOT EXISTS student_check_ins_restaurant_id_idx ON public.student_check_ins (restaurant_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_check_ins ENABLE ROW LEVEL SECURITY;
