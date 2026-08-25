"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Car, Check, Lock, Mail, Phone, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Logo } from "@/components/brand/logo";
import { Segmented } from "@/components/ui/primitives";
import { GuestOnly } from "@/components/layout/role-guard";
import { registerAccount } from "@/lib/auth/actions";
import { errorMessage } from "@/lib/auth/identity-store";
import { homeForRole, ROUTES, VEHICLE_IMAGES, VEHICLE_TYPES } from "@/lib/constants";
import type { VehicleTypeCode } from "@/types";
import { cn } from "@/lib/utils";

const personal = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+94|0)?7\d{8}$/, "Enter a valid Sri Lankan mobile number"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

const vehicle = z.object({
  make: z.string().trim().min(2, "Required"),
  model: z.string().trim().min(1, "Required"),
  plate: z.string().trim().min(4, "Enter the registration number").max(12),
  color: z.string().trim().min(2, "Required"),
  typeCode: z.enum(["BIKE", "TUK", "CAR", "XL"]),
  licenseNumber: z.string().trim().min(6, "Enter your licence number"),
  licenseExpiry: z.string().refine((v) => !!v && new Date(v) > new Date(), "Licence must be valid (future date)"),
});

type PersonalValues = z.infer<typeof personal>;
type VehicleValues = z.infer<typeof vehicle>;

export default function SignupPage() {
  return (
    <GuestOnly>
      <React.Suspense>
        <SignupScreen />
      </React.Suspense>
    </GuestOnly>
  );
}

function SignupScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const initialRole = search.get("role") === "Driver" ? "Driver" : "Rider";
  const [role, setRole] = React.useState<"Rider" | "Driver">(initialRole);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const personalForm = useForm<PersonalValues>({
    resolver: zodResolver(personal),
    defaultValues: { name: "", email: "", phone: "", password: "" },
    mode: "onTouched",
  });
  const vehicleForm = useForm<VehicleValues>({
    resolver: zodResolver(vehicle),
    defaultValues: { make: "", model: "", plate: "", color: "", typeCode: "CAR", licenseNumber: "", licenseExpiry: "" },
    mode: "onTouched",
  });

  const pw = personalForm.watch("password");
  const strength = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;

  const submitAll = async (p: PersonalValues, v?: VehicleValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const session = await registerAccount({
        name: p.name,
        email: p.email,
        phone: p.phone,
        password: p.password,
        role,
        vehicle: v
          ? {
              make: v.make,
              model: v.model,
              plate: v.plate.toUpperCase(),
              color: v.color,
              typeCode: v.typeCode,
              licenseNumber: v.licenseNumber,
              licenseExpiry: v.licenseExpiry,
            }
          : undefined,
      });
      router.replace(homeForRole(session.user.role));
    } catch (e) {
      setServerError(errorMessage(e, "Unable to create your account."));
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  const onPersonal = personalForm.handleSubmit(async (values) => {
    if (role === "Driver") setStep(2);
    else await submitAll(values);
  });
  const onVehicle = vehicleForm.handleSubmit(async (values) => submitAll(personalForm.getValues(), values));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-1 flex-col px-5 pb-6 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <Logo height={26} />
          <Link href={ROUTES.login} className="text-xs font-semibold text-muted hover:text-ink">
            Sign in
          </Link>
        </div>

        <h1 className="text-[26px] font-bold leading-tight tracking-tight">
          {role === "Driver" ? "Drive with GoRide 🚕" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm font-normal text-muted">
          {role === "Driver"
            ? "Tell us about you and your vehicle. We'll verify your documents before you go online."
            : "Book in seconds, track live, pay by card or cash."}
        </p>

        <Segmented
          className="mt-5"
          value={role}
          onChange={(r) => {
            setRole(r);
            setStep(1);
          }}
          options={[
            { value: "Rider", label: "I need rides" },
            { value: "Driver", label: "I want to drive" },
          ]}
        />

        {role === "Driver" && (
          <ol className="mt-5 flex items-center gap-2 text-[11px] font-semibold">
            {["Personal", "Vehicle & licence"].map((s, i) => {
              const n = (i + 1) as 1 | 2;
              const done = step > n;
              const active = step === n;
              return (
                <li key={s} className="flex flex-1 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                      done ? "bg-brand-400 text-ink" : active ? "bg-ink text-white" : "bg-surface-2 text-muted",
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={3} /> : n}
                  </span>
                  <span className={cn(active ? "text-ink" : "text-muted")}>{s}</span>
                  {i === 0 && <span className="h-px flex-1 bg-zinc-200" />}
                </li>
              );
            })}
          </ol>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {step === 1 ? (
            <motion.form
              key="p"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
              onSubmit={onPersonal}
              className="mt-5 flex flex-col gap-4"
              noValidate
            >
              <Input
                label="Full name"
                autoComplete="name"
                placeholder="Nimali Perera"
                leftIcon={<UserIcon size={17} />}
                error={personalForm.formState.errors.name?.message}
                {...personalForm.register("name")}
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                leftIcon={<Mail size={17} />}
                error={personalForm.formState.errors.email?.message}
                {...personalForm.register("email")}
              />
              <Input
                label="Mobile number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07X XXX XXXX"
                leftIcon={<Phone size={17} />}
                error={personalForm.formState.errors.phone?.message}
                {...personalForm.register("phone")}
              />
              <div>
                <Input
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  leftIcon={<Lock size={17} />}
                  error={personalForm.formState.errors.password?.message}
                  {...personalForm.register("password")}
                />
                <div className="mt-2 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i < strength
                          ? strength <= 1
                            ? "bg-danger"
                            : strength === 2
                              ? "bg-warning"
                              : "bg-brand-500"
                          : "bg-zinc-200",
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted">Use 8+ characters with an uppercase letter and a number.</p>
              </div>
              {serverError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-danger">{serverError}</p>
              )}
              <Button
                type="submit"
                size="lg"
                loading={submitting}
                rightIcon={role === "Driver" ? <ArrowRight size={18} /> : undefined}
              >
                {role === "Driver" ? "Next: vehicle details" : "Create account"}
              </Button>
            </motion.form>
          ) : (
            <motion.form
              key="v"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22 }}
              onSubmit={onVehicle}
              className="mt-5 flex flex-col gap-4"
              noValidate
            >
              <button
                type="button"
                onClick={() => setStep(1)}
                className="-ml-1 inline-flex w-fit items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div>
                <p className="mb-2 text-[13px] font-semibold">Vehicle type</p>
                <div className="grid grid-cols-4 gap-2">
                  {VEHICLE_TYPES.map((vt) => {
                    const selected = vehicleForm.watch("typeCode") === vt.code;
                    return (
                      <button
                        key={vt.code}
                        type="button"
                        onClick={() => vehicleForm.setValue("typeCode", vt.code as VehicleTypeCode, { shouldValidate: true })}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border-2 bg-surface-2 p-2 transition",
                          selected ? "border-ink bg-white" : "border-transparent hover:border-zinc-300",
                        )}
                      >
                        <Image
                          src={VEHICLE_IMAGES[vt.code]}
                          alt={vt.name}
                          width={64}
                          height={40}
                          className="h-9 w-auto object-contain mix-blend-multiply"
                        />
                        <span className="text-[11px] font-semibold">{vt.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Make" placeholder="Toyota" error={vehicleForm.formState.errors.make?.message} {...vehicleForm.register("make")} />
                <Input label="Model" placeholder="Aqua" error={vehicleForm.formState.errors.model?.message} {...vehicleForm.register("model")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Registration no."
                  placeholder="CAB-1234"
                  className="uppercase"
                  error={vehicleForm.formState.errors.plate?.message}
                  {...vehicleForm.register("plate")}
                />
                <Input label="Colour" placeholder="White" error={vehicleForm.formState.errors.color?.message} {...vehicleForm.register("color")} />
              </div>
              <Input
                label="Driving licence no."
                placeholder="B1234567"
                error={vehicleForm.formState.errors.licenseNumber?.message}
                {...vehicleForm.register("licenseNumber")}
              />
              <Input
                label="Licence expiry"
                type="date"
                error={vehicleForm.formState.errors.licenseExpiry?.message}
                {...vehicleForm.register("licenseExpiry")}
              />
              {serverError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-danger">{serverError}</p>
              )}
              <Button type="submit" size="lg" variant="driver" loading={submitting} leftIcon={<Car size={18} />}>
                Create driver account
              </Button>
              <p className="text-center text-[11px] font-normal text-muted">
                You&apos;ll upload your licence and vehicle documents next. An admin reviews them before you can go
                online.
              </p>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-auto pt-8 text-center text-sm font-normal">
          Already have an account?{" "}
          <Link href={ROUTES.login} className="font-semibold text-ink underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
