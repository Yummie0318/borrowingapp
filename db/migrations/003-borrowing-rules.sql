-- Borrowing rules: per-item maximum duration, per-item approval setting,
-- waitlist, pickup deadlines and expired reservations.
-- Safe to run more than once. Run it after 002-inventory.sql.

alter table loans drop constraint if exists loans_status_check;
alter table loans add constraint loans_status_check
  check (status in ('waitlisted','requested','approved','declined','borrowed','returned','cancelled','expired'));

alter table loans add column if not exists loan_hours int;          -- duration the student chose
alter table loans add column if not exists pickup_by  timestamptz;  -- reservation expires if not picked up by then

alter table items add column if not exists max_loan_hours int;      -- null = use the category's days x 24
alter table items add column if not exists approval text not null default 'inherit';
alter table items drop constraint if exists items_approval_check;
alter table items add constraint items_approval_check check (approval in ('inherit','required','none'));

create index if not exists loans_queue_idx on loans (item_id, status, requested_at);
create index if not exists loans_pickup_idx on loans (status, pickup_by);
