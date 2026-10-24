"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { requireUser } from "./session";
import { MAX_ADMINS } from "./limits";

const enc = encodeURIComponent;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = () => revalidatePath("/", "layout");
const BACK = "/staff/users";
const fail = (m: string): never => redirect(`${BACK}?error=${enc(m)}`);

export async function createUser(formData: FormData) {
  await requireUser(["admin"]);
  const schoolId = text(formData, "school_id").toUpperCase();
  const fullName = text(formData, "full_name");
  const role = text(formData, "role");
  const grade = role === "student" ? text(formData, "grade_section") || null : null;
  const password = String(formData.get("password") ?? "");

  if (!schoolId || !fullName) fail("School ID and full name are required.");
  if (!["student", "staff", "admin"].includes(role)) fail("Choose a role.");
  if (password.length < 8) fail("The password must be at least 8 characters.");

  const dup = await sql`select 1 from users where upper(school_id) = ${schoolId}`;
  if (dup.length) fail(`The ID ${schoolId} is already used.`);

  const hash = await bcrypt.hash(password, 10);

  // The admin limit is checked inside the insert, so it cannot be bypassed.
  const r = await sql`
    insert into users (school_id, full_name, role, grade_section, password_hash)
    select ${schoolId}::text, ${fullName}::text, ${role}::text, ${grade}::text, ${hash}::text
    where (${role}::text <> 'admin' or (select count(*) from users where role = 'admin') < ${MAX_ADMINS}::int)
    returning id`;
  if (!r.length) fail(`You can only have ${MAX_ADMINS} admins. Use the staff role instead.`);

  done();
  redirect(`${BACK}?msg=${enc(`${fullName} was added as ${role}.`)}`);
}

export async function updateUser(formData: FormData) {
  await requireUser(["admin"]);
  const id = Number(formData.get("user_id"));
  const schoolId = text(formData, "school_id").toUpperCase();
  const fullName = text(formData, "full_name");

  const cur = (await sql`select role from users where id = ${id}`)[0];
  if (!cur) return fail("That user no longer exists.");

  // An admin's role is locked. Everyone else can be a student, staff or (within the limit) admin.
  const role = cur.role === "admin" ? "admin" : text(formData, "role");
  const grade = role === "student" ? text(formData, "grade_section") || null : null;

  if (!schoolId || !fullName) return fail("School ID and full name are required.");
  if (!["student", "staff", "admin"].includes(role)) return fail("Choose a role.");

  const dup = await sql`select 1 from users where upper(school_id) = ${schoolId} and id <> ${id}`;
  if (dup.length) return fail(`The ID ${schoolId} is already used by another user.`);

  // Promoting someone to admin is checked inside the update, so the limit cannot be bypassed.
  const r = await sql`
    update users set school_id = ${schoolId}, full_name = ${fullName}, role = ${role}, grade_section = ${grade}
    where id = ${id}
      and (${role}::text <> 'admin' or ${cur.role}::text = 'admin'
           or (select count(*) from users where role = 'admin') < ${MAX_ADMINS}::int)
    returning id`;
  if (!r.length) return fail(`You can only have ${MAX_ADMINS} admins.`);

  done();
  redirect(`${BACK}?msg=${enc(`${fullName} was updated.`)}`);
}

export async function resetPassword(formData: FormData) {
  await requireUser(["admin"]);
  const id = Number(formData.get("user_id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) fail("The new password must be at least 8 characters.");

  const hash = await bcrypt.hash(password, 10);
  const r = await sql`update users set password_hash = ${hash} where id = ${id} returning full_name`;
  if (!r.length) fail("That user no longer exists.");

  done();
  redirect(`${BACK}?msg=${enc(`Password changed for ${r[0].full_name}.`)}`);
}

export async function deleteUser(formData: FormData) {
  const me = await requireUser(["admin"]);
  const id = Number(formData.get("user_id"));

  const cur = (await sql`select full_name, role from users where id = ${id}`)[0];
  if (!cur) return fail("That user no longer exists.");
  if (cur.role === "admin") return fail("Admins cannot be deleted.");
  if (id === me.uid) return fail("You cannot delete your own account.");

  // Only users with no borrowing or activity history can be removed.
  const r = await sql`
    delete from users u where u.id = ${id} and u.role <> 'admin'
      and not exists (select 1 from loans l where l.user_id = u.id or l.handled_by = u.id)
      and not exists (select 1 from loan_events e where e.actor_id = u.id)
      and not exists (select 1 from item_events e where e.actor_id = u.id)
    returning u.id`;
  if (!r.length) return fail(`${cur.full_name} has borrowing or activity history and cannot be deleted. You can reset their password or change their details instead.`);

  done();
  redirect(`${BACK}?msg=${enc(`${cur.full_name} was deleted.`)}`);
}