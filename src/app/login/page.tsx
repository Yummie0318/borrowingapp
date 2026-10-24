import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { login } from "@/lib/actions";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export const dynamic = "force-dynamic";

const steps = [
  ["Request", "Pick an item from the catalog."],
  ["Approval", "Staff review items that need it."],
  ["Pickup", "Show your school ID at the desk."],
  ["Return", "Bring it back before the stamp date."],
];

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const s = await getSession();
  if (s) redirect(s.role === "student" ? "/" : "/staff");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-forest px-5 py-5 text-white sm:px-8 lg:px-16 lg:py-20">
        <p className="font-display text-lg font-bold lg:text-xl">BorrowDesk</p>
        <h1 className="mt-3 max-w-md text-2xl font-bold leading-tight sm:text-3xl lg:mt-12 lg:text-5xl">
          Borrow it. Return it. Always know where it is.
        </h1>
        <p className="mt-2 text-xs text-white/75 lg:hidden">Request · Approval · Pickup · Return</p>

        <ol className="mt-12 hidden max-w-md space-y-5 lg:block">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/40 font-display font-semibold">{i + 1}</span>
              <p><span className="font-semibold">{t}.</span> <span className="text-white/80">{d}</span></p>
            </li>
          ))}
        </ol>
        <p className="mt-12 hidden max-w-md text-sm text-white/70 lg:block">
          You get a message at every step, so you never have to ask the desk where your request stands.
        </p>
      </section>

      <section className="relative flex items-start justify-center px-5 pb-10 pt-8 sm:px-8 lg:items-center lg:px-16 lg:py-12">
        <div className="absolute right-3 top-3 lg:right-6 lg:top-5">
          <ThemeSwitcher />
        </div>

        <form action={login} className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mb-6 mt-1 text-sm text-ink/70">Use your school ID and the password from the school office.</p>
          {searchParams.error && (
            <p role="alert" className="mb-4 rounded-md border border-alert/30 bg-alert-bg px-3 py-2 text-sm text-alert">
              That school ID and password do not match. Check both and try again.
            </p>
          )}
          <label className="label" htmlFor="school_id">School ID</label>
          <input
            id="school_id"
            name="school_id"
            className="field mb-4"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <PasswordField id="password" name="password" label="Password" autoComplete="current-password" />
          <SubmitButton pendingLabel="Signing in...">Sign in</SubmitButton>

          <div className="mt-8 rounded-md border border-dashed border-line p-3 text-xs text-ink/70">
            <p className="font-medium text-ink">Demo accounts (password123)</p>
            <p>Student: STU-2026-001</p>
            <p>Staff: STAFF-001</p>
            <p>Admin: ADMIN-001</p>
          </div>
        </form>
      </section>
    </div>
  );
}