import type { ReactNode } from "react";

export interface AuthShellProps {
  children: ReactNode;
  /** Copy shown on the brand panel — differs per screen. */
  tagline?: string;
}

/**
 * AuthShell — the split screen shared by login / signup (and later verify,
 * forgot-password): the form on the left, the GoRide brand panel on the right.
 * Below `lg` the brand panel drops away and the form takes the full width.
 *
 * TODO: swap the placeholder panel for the real brand artwork / illustration.
 */
export default function AuthShell({ children, tagline }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh w-full items-stretch bg-zinc-100">
      <main className="flex w-full min-w-0 flex-col overflow-y-auto bg-white lg:w-1/2 lg:shrink-0">
        <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-8">
          {children}
        </div>
      </main>

      <aside className="hidden min-w-0 flex-1 flex-col justify-end bg-zinc-900 p-10 text-white lg:flex">
        <p className="text-3xl font-bold leading-tight tracking-tight">GoRide</p>
        <p className="mt-3 max-w-sm text-sm text-zinc-400">
          {tagline ?? "Book a ride, drive with us, or run the platform — one account for all of it."}
        </p>
      </aside>
    </div>
  );
}

/** Small header used at the top of each auth form column. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-7">
      <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
    </header>
  );
}
