-- Inventory update: damage tracking (reason + repairable or not) and an item history log.
-- Safe to run more than once. Run it in the Neon SQL Editor on the database your .env.local points to.

alter table items drop constraint if exists items_status_check;
alter table items add constraint items_status_check
  check (status in ('available','reserved','borrowed','damaged','under_repair','retired','lost'));

alter table items add column if not exists damage_reason text;
alter table items add column if not exists repairable    boolean;      -- true / false / null = not assessed yet
alter table items add column if not exists damaged_at    timestamptz;
alter table items add column if not exists repair_notes  text;

create table if not exists item_events (
  id         serial primary key,
  item_id    int not null references items (id) on delete cascade,
  actor_id   int references users (id),
  event      text not null,
  created_at timestamptz not null default now()
);
create index if not exists item_events_idx on item_events (item_id, created_at desc);
