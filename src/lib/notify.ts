import { sql } from "./db";

export async function notify(
  userId: number,
  kind: string,
  m: { title: string; body: string },
  loanId: number | null
) {
  await sql`insert into notifications (user_id, kind, title, body, loan_id)
            values (${userId}, ${kind}, ${m.title}, ${m.body}, ${loanId})`;
}

export async function logEvent(loanId: number, actorId: number | null, event: string) {
  await sql`insert into loan_events (loan_id, actor_id, event) values (${loanId}, ${actorId}, ${event})`;
}
