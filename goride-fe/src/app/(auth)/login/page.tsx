"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Car, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Logo } from "@/components/brand/logo";
import { Divider } from "@/components/ui/primitives";
import { GuestOnly } from "@/components/layout/role-guard";
import { loginWithPassword } from "@/lib/auth/actions";
import { errorMessage } from "@/lib/auth/identity-store";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, homeForRole, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <GuestOnly>
      <React.Suspense>
        <LoginScreen />
      </React.Suspense>
    </GuestOnly>
  );
}

function LoginScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = search.get("returnTo");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const session = await loginWithPassword(values.email, values.password);
      router.replace(returnTo && returnTo.startsWith("/") ? returnTo : homeForRole(session.user.role));
    } catch (e) {
      setServerError(errorMessage(e, "Unable to sign in. Please try again."));
    }
  };

  const fillDemo = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setServerError(null);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-1 flex-col px-5 pb-6 pt-6">
        <div className="mb-8 flex items-center justify-between">
          <Logo height={26} priority />
          <Link href={ROUTES.home} className="text-xs font-semibold text-muted hover:text-ink">
            Back
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">Welcome back 👋</h1>
          <p className="mt-1.5 text-sm font-normal text-muted">
            Sign in to book a ride, go online as a driver, or manage the platform — we&apos;ll take you to the right
            place.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onSubmit={handleSubmit(onSubmit)}
          className="mt-7 flex flex-col gap-4"
          noValidate
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            leftIcon={<Mail size={17} />}
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            leftIcon={<Lock size={17} />}
            error={errors.password?.message}
            {...register("password")}
          />
          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-danger" role="alert">
              {serverError}
            </p>
          )}
          <Button type="submit" size="lg" loading={isSubmitting} loadingText="Signing in…">
            Sign in
          </Button>
        </motion.form>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-6">
          <Divider label="Demo accounts" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.role}
                type="button"
                onClick={() => fillDemo(a.email)}
                className="group flex flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-ink hover:shadow-card"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg text-white",
                    a.role === "Rider" ? "bg-brand-500" : a.role === "Driver" ? "bg-driver-500" : "bg-navy-900",
                  )}
                >
                  {a.role === "Rider" ? <Sparkles size={14} /> : a.role === "Driver" ? <Car size={14} /> : <ShieldCheck size={14} />}
                </span>
                <span className="text-xs font-semibold">{a.role}</span>
                <span className="text-[10px] font-normal leading-tight text-muted">{a.hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] font-normal text-zinc-400">
            Tap a role to fill the form · password <code className="rounded bg-surface-2 px-1">{DEMO_PASSWORD}</code>
          </p>
        </motion.div>

        <div className="mt-auto pt-8">
          <p className="text-center text-sm font-normal">
            Don&apos;t have an account?{" "}
            <Link href={ROUTES.signup} className="font-semibold text-ink underline-offset-2 hover:underline">
              Sign up
            </Link>
          </p>
          <Button href={`${ROUTES.signup}?role=Driver`} variant="driver" className="mt-4" leftIcon={<Car size={18} />}>
            Drive with GoRide
          </Button>
          <p className="mt-5 text-center text-[11px] font-normal leading-relaxed text-zinc-400">
            By continuing you agree to GoRide&apos;s <span className="font-semibold underline">Terms of Service</span>{" "}
            and <span className="font-semibold underline">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
