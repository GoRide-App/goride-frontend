"use client";

import * as React from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { DriverProfile, VehicleTypeCode } from "@/types";
import { RoleGuard, useCurrentUser } from "@/components/layout/role-guard";
import { AppShell } from "@/components/layout/app-shell";
import { EmergencyContactsSection, ProfileScreen } from "@/components/profile/profile-screen";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import { VEHICLE_IMAGES, VEHICLE_TYPES } from "@/lib/constants";
import { Badge, Card, SectionTitle, Skeleton, type Tone } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Input, Toggle } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";

/** Driver profile — FR-AUTH-04 / FR-DRV-01. */
export default function DriverProfilePage() {
  return (
    <RoleGuard role="Driver">
      <DriverProfilePageInner />
    </RoleGuard>
  );
}

function DriverProfilePageInner() {
  const user = useCurrentUser()!;
  return (
    <AppShell user={user} className="max-w-3xl px-0 sm:px-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <ProfileScreen user={user} tone="driver" title="Driver profile">
          <VehicleSection driverId={user.id} />
          <EmergencyContactsSection user={user} />
        </ProfileScreen>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicle, licence & verification                                      */
/* ------------------------------------------------------------------ */

const vehicleSchema = z.object({
  vehicleMake: z.string().trim().min(2, "Required"),
  vehicleModel: z.string().trim().min(1, "Required"),
  vehiclePlate: z.string().trim().min(4, "Enter the registration number").max(12),
  vehicleColor: z.string().trim().min(2, "Required"),
  vehicleTypeCode: z.enum(["BIKE", "TUK", "CAR", "XL"]),
  licenseNumber: z.string().trim().min(6, "Enter your licence number"),
  licenseExpiry: z.string().refine((v) => !!v && new Date(v) > new Date(), "Licence must be valid (future date)"),
});
type VehicleValues = z.infer<typeof vehicleSchema>;

const STATUS_TONE: Record<DriverProfile["status"], Tone> = {
  PendingVerification: "warning",
  DocumentReview: "info",
  Active: "success",
  Rejected: "danger",
  Suspended: "danger",
  Deactivated: "neutral",
  Offline: "neutral",
};

function VehicleSection({ driverId }: { driverId: string }) {
  const [profile, setProfile] = React.useState<DriverProfile | null | undefined>(undefined);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<VehicleValues>({ resolver: zodResolver(vehicleSchema) });

  React.useEffect(() => {
    identity
      .getDriverProfile(driverId)
      .then((p) => {
        setProfile(p);
        if (p)
          reset({
            vehicleMake: p.vehicleMake,
            vehicleModel: p.vehicleModel,
            vehiclePlate: p.vehiclePlate,
            vehicleColor: p.vehicleColor ?? "",
            vehicleTypeCode: p.vehicleTypeCode,
            licenseNumber: p.licenseNumber,
            licenseExpiry: p.licenseExpiry,
          });
      })
      .catch(() => setProfile(null));
  }, [driverId, reset]);

  const onSubmit = async (v: VehicleValues) => {
    try {
      const saved = await identity.updateDriverProfile(driverId, { ...v, vehiclePlate: v.vehiclePlate.toUpperCase() });
      setProfile(saved);
      reset({ ...v, vehiclePlate: saved.vehiclePlate });
      toast.success("Vehicle updated", "Your vehicle and licence details have been saved.");
    } catch (e) {
      toast.error("Update failed", errorMessage(e));
    }
  };

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

  if (profile === undefined) return <Skeleton className="mt-8 h-64" />;

  if (profile === null)
    return (
      <section className="mt-8">
        <SectionTitle>Vehicle & licence</SectionTitle>
        <Card>
          <p className="text-sm font-semibold">No vehicle on file</p>
          <p className="mt-1 text-xs text-muted">
            This driver account was created without vehicle details. Add them from driver onboarding before going
            online.
          </p>
        </Card>
      </section>
    );

  const selected = watch("vehicleTypeCode");

  return (
    <>
      <section className="mt-8">
        <SectionTitle>Verification</SectionTitle>
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Account status</p>
              <p className="text-xs text-muted">
                {profile.verifiedAt
                  ? `Documents approved on ${formatDate(profile.verifiedAt)}`
                  : "An admin reviews your documents before you can go online."}
              </p>
            </div>
            <Badge tone={STATUS_TONE[profile.status]} dot>
              {profile.status.replace(/([A-Z])/g, " $1").trim()}
            </Badge>
          </div>
          <div className="border-t border-zinc-100 pt-3">
            <Toggle
              checked={profile.online}
              onChange={toggleOnline}
              disabled={profile.status !== "Active"}
              tone="driver"
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

      <section className="mt-8">
        <SectionTitle>Vehicle & licence</SectionTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div>
            <p className="mb-2 text-[13px] font-semibold">Vehicle type</p>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLE_TYPES.map((vt) => (
                <button
                  key={vt.code}
                  type="button"
                  onClick={() => setValue("vehicleTypeCode", vt.code as VehicleTypeCode, { shouldDirty: true, shouldValidate: true })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 bg-surface-2 p-2 transition",
                    selected === vt.code ? "border-ink bg-white" : "border-transparent hover:border-zinc-300",
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
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Make" error={errors.vehicleMake?.message} {...register("vehicleMake")} />
            <Input label="Model" error={errors.vehicleModel?.message} {...register("vehicleModel")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Registration no." className="uppercase" error={errors.vehiclePlate?.message} {...register("vehiclePlate")} />
            <Input label="Colour" error={errors.vehicleColor?.message} {...register("vehicleColor")} />
          </div>
          <Input label="Driving licence no." error={errors.licenseNumber?.message} {...register("licenseNumber")} />
          <Input label="Licence expiry" type="date" error={errors.licenseExpiry?.message} {...register("licenseExpiry")} />

          <Button type="submit" variant="driver" loading={isSubmitting} disabled={!isDirty}>
            Save vehicle details
          </Button>
        </form>
      </section>
    </>
  );
}
