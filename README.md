# BorrowDesk

A school borrowing system built with Next.js 14 (App Router), TypeScript, Tailwind CSS and Neon Postgres.

## Set up

**New database** (Neon SQL Editor, run these three files in order):
1. `db/neon-import.sql`
2. `db/migrations/002-inventory.sql`
3. `db/migrations/003-borrowing-rules.sql`

**Existing database that already ran the first two:** run only `db/migrations/003-borrowing-rules.sql`.

Then:
```
copy .env.example .env.local     (fill in DATABASE_URL, SESSION_SECRET, CRON_SECRET)
npm install
npm run dev
```

Demo accounts, password `password123`: `STU-2026-001` (student), `STAFF-001`, `ADMIN-001`. Change them before real use.

## How borrowing works

1. **Student picks a duration** up to the item's maximum (set per item, or inherited from its category).
2. **Approval** is per item: follow the category, always require, or never require.
3. **Free item:** it is reserved at once (or sent to staff if approval is needed). Approved reservations get a
   **pickup deadline**: 4 PM Manila time the same day, or the next day if less than 30 minutes remain.
4. **Missed pickup:** when the deadline passes, the reservation expires, the student is messaged, and the item goes to
   the next person in line (or back to available). Three missed pickups within 30 days pause borrowing for that student.
5. **Item in use:** the student joins a **waitlist** (first come, first served) with an estimated date.
   When the item is returned, cancelled, declined, repaired, or its reservation expires, the longest-waiting student
   automatically gets it and is messaged. A damaged return holds the queue until the item is repaired.
6. **Checkout** starts the clock: due date = pickup time + the duration the student chose.
7. Reminders (due soon, overdue) and every status change are sent as messages and logged.

## Settings

- `src/lib/config.ts`: items per student, desk closing hour (pickup deadline), missed-pickup limit and period.
- `src/lib/templates.ts`: wording of every message.
- Categories tab in the app: default longest time and approval rule. Item page: per-item rules.

## Appearance

Light, dark or auto, plus six accent colors, from the palette button in the header. The sidebar can be collapsed
or resized by dragging its edge (double-click the edge to reset).

## Housekeeping

Expired reservations and reminders are processed whenever staff or students open the app (at most every 30 seconds)
and by the daily cron in `vercel.json`. Add `CRON_SECRET` to your Vercel environment variables.
