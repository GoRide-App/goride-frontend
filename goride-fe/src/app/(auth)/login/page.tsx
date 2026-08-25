"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-shell";
import { ROUTES } from "@/lib/routes";
import type { LoginValues } from "@/types/auth";

const inputClass =
  "w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900";

/**
 * Login — FR-AUTH-01.
 *
 * STRUCTURE ONLY. What still has to be built:
 *  - validation (email format, password min length) + inline field errors
 *  - call the login endpoint, store the session, redirect via homeForRole()
 *  - honour the `returnTo` query param when it points at an internal path
 *  - loading / disabled states on submit
 */
export default function LoginPage() {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const onChange = (field: keyof LoginValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // TODO: validate, then POST the credentials and redirect on success.
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">GoRide</span>
        <Link href={ROUTES.home} className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">
          Back
        </Link>
      </div>

      <AuthHeader
        title="Welcome back"
        subtitle="Sign in to book a ride, go online as a driver, or manage the platform."
      />

      {/* --- Email + password ------------------------------------------- */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Email</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
            value={values.email}
            onChange={onChange("email")}
          />
          {/* TODO: <FieldError /> */}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[13px] font-semibold">
            Password
            {/* TODO: point at the forgot-password route once it exists. */}
            <span className="text-xs font-semibold text-zinc-400">Forgot password?</span>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClass}
            value={values.password}
            onChange={onChange("password")}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Sign in
        </button>
      </form>

      {/* --- Identity-provider sign-in ---------------------------------- */}
      <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        or
        <span className="h-px flex-1 bg-zinc-200" />
      </div>

      {/* TODO: hand off to the IdP (/login?returnUrl=...) and come back to the dashboard. */}
      <button
        type="button"
        className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold hover:border-zinc-900"
      >
        Continue with GoRide ID
      </button>

      {/* --- Footer ------------------------------------------------------ */}
      <div className="mt-auto pt-10">
        <p className="text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href={ROUTES.signup} className="font-semibold underline-offset-2 hover:underline">
            Sign up
          </Link>
        </p>
        <Link
          href={`${ROUTES.signup}?role=Driver`}
          className="mt-4 block rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-semibold hover:border-zinc-900"
        >
          Drive with GoRide
        </Link>
        <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-400">
          By continuing you agree to GoRide&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </>
  );
}
