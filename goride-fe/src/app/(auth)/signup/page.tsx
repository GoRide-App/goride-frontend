"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-shell";
import { ROUTES } from "@/lib/routes";
import type { SignupValues, VehicleTypeCode, VehicleValues } from "@/types/auth";

const inputClass =
  "w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900";

const VEHICLE_TYPES: { code: VehicleTypeCode; name: string }[] = [
  { code: "BIKE", name: "Bike" },
  { code: "TUK", name: "Tuk" },
  { code: "CAR", name: "Car" },
  { code: "XL", name: "XL" },
];

type Step = 1 | 2;
type PersonalValues = Omit<SignupValues, "role" | "vehicle">;

/**
 * Signup — FR-AUTH-02.
 *
 * Riders finish in one step. Drivers get a second step for vehicle + licence
 * details, then land on email verification.
 *
 * STRUCTURE ONLY. What still has to be built:
 *  - validation per step (name, email, SL mobile, password rules, licence expiry)
 *  - password strength meter feedback
 *  - submit both steps as one register call, then redirect to verify-email
 *  - read `?role=Driver` from the query string to preselect the driver tab
 */
export default function SignupPage() {
  const [role, setRole] = useState<"Rider" | "Driver">("Rider");
  const [step, setStep] = useState<Step>(1);
  const [personal, setPersonal] = useState<PersonalValues>({ name: "", email: "", phone: "", password: "" });
  const [vehicle, setVehicle] = useState<VehicleValues>({
    make: "",
    model: "",
    plate: "",
    color: "",
    typeCode: "CAR",
    licenseNumber: "",
    licenseExpiry: "",
  });
  const [error, setError] = useState<string | null>(null);

  const onPersonal = (field: keyof PersonalValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPersonal((v) => ({ ...v, [field]: e.target.value }));
  const onVehicle = (field: keyof VehicleValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVehicle((v) => ({ ...v, [field]: e.target.value }));

  async function submitStepOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // TODO: validate step 1. Drivers continue to step 2; riders register here.
    if (role === "Driver") setStep(2);
  }

  async function submitStepTwo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // TODO: validate step 2, then register with { ...personal, role, vehicle }.
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">GoRide</span>
        <Link href={ROUTES.login} className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">
          Sign in
        </Link>
      </div>

      <AuthHeader
        title={role === "Driver" ? "Drive with GoRide" : "Create your account"}
        subtitle={
          role === "Driver"
            ? "Tell us about you and your vehicle. We verify your documents before you go online."
            : "Book in seconds, track live, pay by card or cash."
        }
      />

      {/* --- Role switch -------------------------------------------------- */}
      <div className="flex rounded-xl bg-zinc-100 p-1 text-sm font-semibold">
        {(["Rider", "Driver"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              setStep(1);
            }}
            className={
              "flex-1 rounded-lg px-3 py-2 " + (role === r ? "bg-white shadow-sm" : "text-zinc-500")
            }
          >
            {r === "Rider" ? "I need rides" : "I want to drive"}
          </button>
        ))}
      </div>

      {/* --- Driver step indicator ---------------------------------------- */}
      {role === "Driver" && (
        <ol className="mt-5 flex items-center gap-2 text-[11px] font-semibold">
          {["Personal", "Vehicle & licence"].map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full " +
                  (step === i + 1 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500")
                }
              >
                {i + 1}
              </span>
              <span className={step === i + 1 ? "" : "text-zinc-500"}>{label}</span>
              {i === 0 && <span className="h-px flex-1 bg-zinc-200" />}
            </li>
          ))}
        </ol>
      )}

      {step === 1 ? (
        /* --- Step 1: personal details ----------------------------------- */
        <form onSubmit={submitStepOne} className="mt-5 flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Full name</span>
            <input
              autoComplete="name"
              placeholder="Nimali Perera"
              className={inputClass}
              value={personal.name}
              onChange={onPersonal("name")}
            />
            {/* TODO: inline field error */}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
              value={personal.email}
              onChange={onPersonal("email")}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Mobile number</span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="07X XXX XXXX"
              className={inputClass}
              value={personal.phone}
              onChange={onPersonal("phone")}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className={inputClass}
              value={personal.password}
              onChange={onPersonal("password")}
            />
            {/* TODO: strength meter — 8+ chars, an uppercase letter and a number. */}
            <span className="text-[11px] text-zinc-500">
              Use 8+ characters with an uppercase letter and a number.
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            className="mt-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {role === "Driver" ? "Next: vehicle details" : "Create account"}
          </button>
        </form>
      ) : (
        /* --- Step 2: vehicle + licence (drivers only) -------------------- */
        <form onSubmit={submitStepTwo} className="mt-5 flex flex-col gap-4" noValidate>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-fit text-xs font-semibold text-zinc-500 hover:text-zinc-900"
          >
            &larr; Back
          </button>

          <div>
            <p className="mb-2 text-[13px] font-semibold">Vehicle type</p>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLE_TYPES.map((vt) => (
                <button
                  key={vt.code}
                  type="button"
                  onClick={() => setVehicle((v) => ({ ...v, typeCode: vt.code }))}
                  className={
                    "rounded-xl border-2 bg-zinc-50 p-3 text-[11px] font-semibold " +
                    (vehicle.typeCode === vt.code ? "border-zinc-900 bg-white" : "border-transparent")
                  }
                >
                  {/* TODO: vehicle artwork goes here. */}
                  {vt.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Make</span>
              <input placeholder="Toyota" className={inputClass} value={vehicle.make} onChange={onVehicle("make")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Model</span>
              <input placeholder="Aqua" className={inputClass} value={vehicle.model} onChange={onVehicle("model")} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Registration no.</span>
              <input
                placeholder="CAB-1234"
                className={inputClass + " uppercase"}
                value={vehicle.plate}
                onChange={onVehicle("plate")}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Colour</span>
              <input placeholder="White" className={inputClass} value={vehicle.color} onChange={onVehicle("color")} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Driving licence no.</span>
            <input
              placeholder="B1234567"
              className={inputClass}
              value={vehicle.licenseNumber}
              onChange={onVehicle("licenseNumber")}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Licence expiry</span>
            <input
              type="date"
              className={inputClass}
              value={vehicle.licenseExpiry}
              onChange={onVehicle("licenseExpiry")}
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            className="mt-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Create driver account
          </button>
          <p className="text-center text-[11px] text-zinc-500">
            You&apos;ll upload your licence and vehicle documents next. An admin reviews them before you can go online.
          </p>
        </form>
      )}

      <p className="mt-auto pt-10 text-center text-sm">
        Already have an account?{" "}
        <Link href={ROUTES.login} className="font-semibold underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
