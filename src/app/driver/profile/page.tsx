"use client";

import * as React from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DriverProfile, User } from "@/types";
import { AppShell } from "@/components/layout/app-shell";
import {
  EmergencyContactsSection,
  ProfileScreen,
  ProfileSectionTitle,
} from "@/components/profile/profile-screen";
import { ScreenError, ScreenLoader } from "@/components/dashboard/screen-loader";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import {
  DRIVER_STATUS_META,
  identityLoginUrl,
  normalizeRole,
  ROUTES,
  VEHICLE_IMAGES,
  VEHICLE_TYPES,
} from "@/lib/constants";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Input, Toggle } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import {
  addDriverProfile,
  getDriverProfile,
  getMe,
  updateDriverProfile,
  type DriverVehiclePayload,
} from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/session";

/** Driver profile — FR-AUTH-04 / FR-DRV-01. */
export default function DriverProfilePage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<User | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    const sessionUser = useAuthStore.getState().session?.user;

    if (!sessionUser) {
      window.location.replace(identityLoginUrl(ROUTES.driver.profile));
      return;
    }

    getMe()
      .then((me) => {
        const currentUser =
          me ??
          (sessionUser
            ? {
                userId: sessionUser.id,
                name: sessionUser.name,
                email: sessionUser.email,
                phone: sessionUser.phone ?? null,
                roles: [sessionUser.role],
              }
            : null);

        const normalizedRoles = (currentUser?.roles ?? []).map((value) =>
          normalizeRole(value),
        );
        if (!currentUser || !normalizedRoles.includes("Driver")) {
          router.replace(ROUTES.dashboard);
          return;
        }

        setDriverId(currentUser.userId);
        setUser({
          id: currentUser.userId,
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone ?? null,
          role: "Driver",
          emailVerified: true,
          phoneVerified: false,
          rating: 5,
          ratingCount: 0,
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => setError("Unable to load your driver profile."))
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <ScreenLoader label="Loading your profile…" />;
  if (error)
    return (
      <ScreenError
        title="Couldn't load your profile"
        message={error}
        action={
          <Button href={ROUTES.dashboard} variant="dark">
            Back to dashboard
          </Button>
        }
      />
    );
  if (!user) return null;

  if (!driverId) return null;

  return <DriverProfilePageInner user={user} driverId={driverId} />;
}

function DriverProfilePageInner({
  user,
  driverId,
}: {
  user: User;
  driverId: string;
}) {
  return (
    <AppShell
      user={{
        role: "Driver",
        name: user.name,
        email: user.email,
      }}
      className="max-w-[720px]"
    >
      <ProfileScreen user={user} tone="driver" title="Driver profile" phoneOnly>
        <VehicleSection driverId={driverId} />
        <EmergencyContactsSection user={user} />
      </ProfileScreen>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicle, licence & verification                                      */
/* ------------------------------------------------------------------ */

const vehicleSchema = z.object({
  vehicleMake: z.string().trim().min(2, "Required"),
  vehicleModel: z.string().trim().min(1, "Required"),
  vehiclePlate: z
    .string()
    .trim()
    .min(4, "Enter the registration number")
    .max(12),
  vehicleColor: z.string().optional(),
  vehicleTypeCode: z.enum(["BIKE", "TUK", "CAR", "XL"]),
  licenseNumber: z.string().trim().min(6, "Enter your licence number"),
  licenseExpiry: z
    .string()
    .refine(
      (v) => !!v && new Date(v) > new Date(),
      "Licence must be valid (future date)",
    ),
});
type VehicleValues = z.infer<typeof vehicleSchema>;

function VehicleSection({ driverId }: { driverId: string }) {
  const [profile, setProfile] = React.useState<
    DriverProfile | null | undefined
  >(undefined);

  React.useEffect(() => {
    getDriverProfile(driverId)
      .then((p) => {
        setProfile(p);
      })
      .catch(() => setProfile(null));
  }, [driverId]);

  const toggleOnline = async (online: boolean) => {
    if (!profile) return;
    const previous = profile;
    setProfile({ ...profile, online });
    try {
      setProfile(await identity.updateDriverProfile(driverId, { online }));
    } catch (e) {
      setProfile(previous);
      toast.error("Couldn't change availability", errorMessage(e));
    }
  };

  if (profile === undefined) return <Skeleton className="h-64 rounded-card" />;

  if (profile === null)
    return (
      <section aria-labelledby="profile-vehicle-title">
        <ProfileSectionTitle id="profile-vehicle-title">Vehicle &amp; licence</ProfileSectionTitle>
        <Card>
          <p className="text-[13px] leading-relaxed text-muted text-pretty">
            Register your vehicle and driving licence. An admin reviews them before you can go online.
          </p>
          <VehicleForm
            className="mt-4"
            submitLabel="Register vehicle"
            onSave={async (values) => {
              const saved = await addDriverProfile(values);
              setProfile({ ...saved, driverId });
              return saved;
            }}
          />
        </Card>
      </section>
    );

  const status = profile.status ?? "PendingVerification";
  const statusMeta = DRIVER_STATUS_META[status] ?? DRIVER_STATUS_META.PendingVerification;

  return (
    <>
      <section aria-labelledby="profile-verification-title">
        <ProfileSectionTitle id="profile-verification-title">Verification</ProfileSectionTitle>
        <Card padded={false} className="divide-y divide-line">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-snug">Account status</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted text-pretty">
                {profile.verifiedAt
                  ? `Documents approved on ${formatDate(profile.verifiedAt)}`
                  : "An admin reviews your documents before you can go online."}
              </p>
            </div>
            <Badge tone={statusMeta.tone} dot size="md">
              {statusMeta.label}
            </Badge>
          </div>
          <div className="p-4">
            <Toggle
              checked={profile.online}
              onChange={toggleOnline}
              disabled={profile.status !== "Active"}
              tone="brand"
              label="Available for trips"
              description={
                profile.status === "Active"
                  ? "Riders can be matched to you while this is on"
                  : "You can go online once your documents are approved"
              }
            />
          </div>
        </Card>
      </section>

      <section aria-labelledby="profile-vehicle-title">
        <ProfileSectionTitle id="profile-vehicle-title">Vehicle &amp; licence</ProfileSectionTitle>
        <Card>
          <VehicleForm
            profile={profile}
            submitLabel="Save vehicle details"
            onSave={async (values) => {
              const saved = await updateDriverProfile(driverId, values);
              setProfile({ ...saved, driverId });
              return saved;
            }}
          />
        </Card>
      </section>
    </>
  );
}

function VehicleForm({
  profile,
  submitLabel,
  onSave,
  className,
}: {
  profile?: DriverProfile;
  submitLabel: string;
  onSave: (values: DriverVehiclePayload) => Promise<DriverProfile>;
  className?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: profile
      ? {
          vehicleMake: profile.vehicleMake,
          vehicleModel: profile.vehicleModel,
          vehiclePlate: profile.vehiclePlate,
          vehicleColor: profile.vehicleColor ?? "",
          vehicleTypeCode: profile.vehicleTypeCode,
          licenseNumber: profile.licenseNumber,
          licenseExpiry: profile.licenseExpiry,
        }
      : { vehicleTypeCode: "CAR" },
  });

  const onSubmit = async (values: VehicleValues) => {
    try {
      const vehiclePayload: DriverVehiclePayload = {
        vehicleMake: values.vehicleMake,
        vehicleModel: values.vehicleModel,
        vehiclePlate: values.vehiclePlate.toUpperCase(),
        vehicleTypeCode: values.vehicleTypeCode,
        licenseNumber: values.licenseNumber,
        licenseExpiry: values.licenseExpiry,
      };
      const saved = await onSave(vehiclePayload);
      reset({ ...values, vehiclePlate: saved.vehiclePlate });
      toast.success(
        profile ? "Vehicle updated" : "Vehicle registered",
        "Your vehicle and licence details have been saved.",
      );
    } catch (error) {
      toast.error("Update failed", errorMessage(error));
    }
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const selected = watch("vehicleTypeCode");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("flex flex-col gap-4", className)}
      noValidate
    >
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold leading-none">Vehicle type</legend>
        <div role="radiogroup" aria-label="Vehicle type" className="grid grid-cols-4 gap-2">
          {VEHICLE_TYPES.map((vehicleType) => {
            const active = selected === vehicleType.code;
            return (
              <button
                key={vehicleType.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  setValue("vehicleTypeCode", vehicleType.code, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl p-2.5 pt-3 transition-[background-color,box-shadow,transform] duration-200 ease-(--ease-spring) active:scale-[0.97]",
                  active
                    ? "bg-brand-400 text-ink shadow-[0_6px_14px_-8px_rgba(255,194,26,0.9)]"
                    : "bg-surface-2 text-ink hover:bg-surface-3",
                )}
              >
                <Image
                  src={VEHICLE_IMAGES[vehicleType.code]}
                  alt=""
                  width={64}
                  height={40}
                  className="h-9 w-auto object-contain"
                />
                <span className="text-[12px] font-semibold">
                  {vehicleType.name}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Make"
          placeholder="Toyota"
          error={errors.vehicleMake?.message}
          {...register("vehicleMake")}
        />
        <Input
          label="Model"
          placeholder="Aqua"
          error={errors.vehicleModel?.message}
          {...register("vehicleModel")}
        />
      </div>
      <Input
        label="Registration number"
        placeholder="CAB-1234"
        className="uppercase placeholder:normal-case"
        error={errors.vehiclePlate?.message}
        {...register("vehiclePlate")}
      />
      <Input
        label="Driving licence number"
        error={errors.licenseNumber?.message}
        {...register("licenseNumber")}
      />
      <Input
        label="Licence expiry"
        type="date"
        error={errors.licenseExpiry?.message}
        {...register("licenseExpiry")}
      />
      <Button
        type="submit"
        size="lg"
        variant="dark"
        className="mt-1"
        loading={isSubmitting}
        loadingText="Saving…"
        disabled={profile ? !isDirty : false}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
