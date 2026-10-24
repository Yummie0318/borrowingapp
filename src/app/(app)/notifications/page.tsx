import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { markAllRead } from "@/lib/actions";
import { fmtDateTime } from "@/lib/format";

type N = { id: number; title: string; body: string; read_at: Date | string | null; created_at: Date | string };

export default async function Notifications() {
  const me = await requireUser(["student"]);
  const rows = await sql`select id, title, body, read_at, created_at from notifications where user_id = ${me.uid} order by created_at desc limit 50`;
  const list = rows as unknown as N[];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Messages</h1>
        {unread > 0 && (
          <form action={markAllRead}><button className="btn-quiet">Mark all as read</button></form>
        )}
      </div>

      {list.length === 0 ? (
        <p className="panel p-8 text-center text-ink/70">No messages yet. They will show up here when you request or borrow something.</p>
      ) : (
        <ul className="space-y-2 md:space-y-3">
          {list.map((n) => (
            <li key={n.id} className={`panel p-3 md:p-4 ${n.read_at ? "" : "border-forest/40 bg-mint/60"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">{n.title}</h2>
                <time className="shrink-0 text-xs text-ink/60">{fmtDateTime(n.created_at)}</time>
              </div>
              <p className="mt-1 max-w-prose text-sm leading-relaxed">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
