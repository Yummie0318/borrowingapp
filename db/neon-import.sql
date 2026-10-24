-- BorrowDesk: paste this whole file into the Neon SQL Editor and click Run.
-- Safe to re-run: tables are created only if missing and seed rows are skipped if present.

create extension if not exists pgcrypto;

create table if not exists users (
  id            serial primary key,
  school_id     text unique not null,
  full_name     text not null,
  role          text not null check (role in ('student', 'staff', 'admin')),
  grade_section text,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists categories (
  id                serial primary key,
  name              text unique not null,
  loan_days         int not null default 3 check (loan_days > 0),
  requires_approval boolean not null default false
);

create table if not exists items (
  id          serial primary key,
  code        text unique not null,
  name        text not null,
  category_id int not null references categories (id),
  description text,
  status      text not null default 'available'
              check (status in ('available', 'reserved', 'borrowed', 'damaged', 'lost')),
  created_at  timestamptz not null default now()
);

create table if not exists loans (
  id                     serial primary key,
  item_id                int not null references items (id),
  user_id                int not null references users (id),
  status                 text not null default 'requested'
                         check (status in ('requested', 'approved', 'declined', 'borrowed', 'returned', 'cancelled')),
  note                   text,
  decision_note          text,
  requested_at           timestamptz not null default now(),
  decided_at             timestamptz,
  borrowed_at            timestamptz,
  due_at                 timestamptz,
  returned_at            timestamptz,
  return_condition       text check (return_condition in ('good', 'damaged')),
  handled_by             int references users (id),
  reminded_due_at        timestamptz,
  last_overdue_notice_at timestamptz
);

create table if not exists loan_events (
  id         serial primary key,
  loan_id    int not null references loans (id) on delete cascade,
  actor_id   int references users (id),
  event      text not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id         serial primary key,
  user_id    int not null references users (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null,
  loan_id    int references loans (id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists loans_user_idx   on loans (user_id, status);
create index if not exists loans_status_idx on loans (status, due_at);
create index if not exists items_status_idx on items (status);
create index if not exists notif_user_idx   on notifications (user_id, read_at, created_at desc);

-- Seed data. Demo password for every account: password123  (change before real use)
insert into users (school_id, full_name, role, grade_section, password_hash) values
  ('ADMIN-001',    'Ms. Reyes (Admin)',    'admin',   null,         crypt('password123', gen_salt('bf', 8))),
  ('STAFF-001',    'Mr. Santos (Library)', 'staff',   null,         crypt('password123', gen_salt('bf', 8))),
  ('STU-2026-001', 'Maria Dela Cruz',      'student', 'Grade 10-A', crypt('password123', gen_salt('bf', 8))),
  ('STU-2026-002', 'Juan Bautista',        'student', 'Grade 11-B', crypt('password123', gen_salt('bf', 8))),
  ('STU-2026-003', 'Angela Ramos',         'student', 'Grade 12-C', crypt('password123', gen_salt('bf', 8)))
on conflict (school_id) do nothing;

insert into categories (name, loan_days, requires_approval) values
  ('Books',               14, false),
  ('Sports gear',          2, false),
  ('Lab equipment',        3, true),
  ('Laptops and tablets',  2, true)
on conflict (name) do nothing;

insert into items (code, name, category_id, description)
select v.code, v.name, c.id, v.descr
from (values
  ('BK-001', 'Noli Me Tangere',            'Books',               'Jose Rizal, school edition'),
  ('BK-002', 'Physics: Principles and Problems', 'Books',         'Grade 11 textbook'),
  ('BK-003', 'Fundamentals of Algebra',    'Books',               'Grade 10 reference'),
  ('SP-001', 'Basketball (size 7)',        'Sports gear',         'Indoor and outdoor'),
  ('SP-002', 'Volleyball',                 'Sports gear',         'Official size'),
  ('SP-003', 'Badminton set',              'Sports gear',         '2 rackets and shuttlecocks'),
  ('LB-001', 'Digital microscope',         'Lab equipment',       '40x to 1000x, USB camera'),
  ('LB-002', 'Multimeter',                 'Lab equipment',       'For electronics class'),
  ('LT-001', 'School laptop 01',           'Laptops and tablets', '14 inch, charger included'),
  ('LT-002', 'School laptop 02',           'Laptops and tablets', '14 inch, charger included'),
  ('LT-003', 'Tablet with stylus',         'Laptops and tablets', '10 inch, for drawing and notes')
) as v(code, name, cat, descr)
join categories c on c.name = v.cat
on conflict (code) do nothing;
