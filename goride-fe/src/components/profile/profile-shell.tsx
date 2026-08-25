"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { ProfileValues, User } from "@/types/auth";

const inputClass =
  "w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500";

/**
 * ProfileShell — the common skeleton behind the rider / driver / admin profile
 * pages: identity header, the editable details form, whatever role-specific
 * sections the page passes as `children`, then the danger zone.
 *
 * STRUCTURE ONLY. What still has to be built:
 *  - load the signed-in user (currently passed in from the page)
 *  - validation + inline errors on name / phone
 *  - PATCH the user, keep the session in sync, toast on success/failure
 *  - avatar upload
 *  - wire up the deactivate confirmation dialog
 */
export function ProfileShell({
  user,
  backHref,
  title = "Edit profile",
  children,
}: {
  user: User;
  backHref: string;
  title?: string;
  children?: ReactNode;
}) {
  const [values, setValues] = useState<ProfileValues>({ name: user.name, phone: user.phone ?? "" });

  const onChange = (field: keyof ProfileValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: validate, then save the profile and refresh the session user.
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col px-5 py-6">
      <TopBar back={backHref} title={title} />

      {/* --- Identity ----------------------------------------------------- */}
      <div className="flex flex-col items-center py-5 text-center">
        {/* TODO: avatar component + photo upload. */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-xl font-bold text-zinc-600">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <h2 className="mt-3 text-lg font-semibold">{user.name}</h2>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <span>{user.roles.join(" · ")}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold">
            {user.emailVerified ? "Email verified" : "Email unverified"}
          </span>
        </div>
      </div>

      {/* --- Editable details --------------------------------------------- */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Email</span>
          <input type="email" value={user.email} disabled className={inputClass} />
          <span className="text-[11px] text-zinc-500">
            Managed by GoRide ID — contact support to change it.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Full name</span>
          <input className={inputClass} value={values.name} onChange={onChange("name")} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Mobile number</span>
          <input type="tel" placeholder="07X XXX XXXX" className={inputClass} value={values.phone} onChange={onChange("phone")} />
        </label>

        <button
          type="submit"
          className="mt-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Update profile
        </button>
      </form>

      {/* --- Role-specific sections --------------------------------------- */}
      {children}

      {/* --- Danger zone --------------------------------------------------- */}
      <ProfileSection title="Deactivate account" className="mt-8 border-red-100">
        <p className="text-xs text-zinc-500">
          Your account will be disabled and you&apos;ll be signed out. Trip records are kept for audit.
        </p>
        <button
          type="button"
          // TODO: open a confirm dialog, then call the deactivate endpoint and sign out.
          className="mt-3 w-fit rounded-xl border border-red-300 px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Deactivate
        </button>
      </ProfileSection>
    </div>
  );
}

/** Card wrapper for a titled block on the profile pages. */
export function ProfileSection({
  title,
  description,
  className = "",
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={"mt-6 rounded-2xl border border-zinc-200 p-4 " + className}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      <div className="mt-3 flex flex-col">{children}</div>
    </section>
  );
}

/** A tappable row that links out to a sub-page (notifications, contacts, ...). */
export function ProfileLinkRow({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl px-1 py-2.5 text-sm hover:bg-zinc-50"
    >
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
      <span aria-hidden className="text-zinc-400">&rarr;</span>
    </Link>
  );
}

function TopBar({ back, title }: { back: string; title: string }) {
  return (
    <header className="flex items-center gap-3 border-b border-zinc-100 pb-4">
      <Link href={back} aria-label="Back" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900">
        &larr;
      </Link>
      <h1 className="text-base font-semibold">{title}</h1>
    </header>
  );
}
