"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, KeyRound, LogOut, Mail, Phone, PhoneCall, Plus, ShieldAlert, Star, Trash2, User as UserIcon, UserX } from "lucide-react";
import type { EmergencyContact, NotificationPreferences, User } from "@/types";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import { logout } from "@/lib/auth/actions";
import { useAuthStore } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Card, EmptyState, ListRow, Skeleton, TopBar } from "@/components/ui/primitives";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Toggle } from "@/components/ui/field";
import { ConfirmDialog, DialogIcon } from "@/components/ui/dialog";
import { fades } from "@/components/ui/motion";
import { toast } from "@/components/ui/toast";
import { updatePhoneNumber } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Section heading shared by every profile block                        */
/* ------------------------------------------------------------------ */

export function ProfileSectionTitle({ id, children, right }: { id: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {children}
      </h2>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Identity header: charcoal card with avatar, role, rating, phone      */
/* ------------------------------------------------------------------ */

function ProfileHeader({ user, tone }: { user: User; tone: "rider" | "driver" | "admin" }) {
  const avatarTone = tone === "driver" ? "bg-driver-400 text-ink" : tone === "admin" ? "bg-white text-ink" : "bg-brand-400 text-ink";
  const hasRating = user.ratingCount > 0;
  return (
    <section aria-label="Profile" className="rounded-card bg-navy-900 p-5 text-white md:p-6">
      <div className="flex items-center gap-4 sm:gap-5">
        <Avatar name={user.name} src={user.profilePhotoUrl} size="lg" tone={avatarTone} className="sm:h-24 sm:w-24 sm:text-3xl" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[26px]">{user.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-400 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink">{user.role}</span>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", user.emailVerified ? "bg-white/10 text-white" : "bg-[#ff8a8c]/15 text-[#ffb3b4]")}>
              {user.emailVerified && <BadgeCheck size={12} aria-hidden />}
              {user.emailVerified ? "Email verified" : "Email unverified"}
            </span>
            {hasRating ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                <Star size={12} className="fill-brand-400 text-brand-400" aria-hidden />
                {user.rating.toFixed(1)} <span className="font-normal text-white/60">({user.ratingCount})</span>
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">No ratings yet</span>
            )}
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-white/60">
            <Phone size={13} className="shrink-0" aria-hidden />
            <span className="truncate">{user.phone ?? "No mobile number yet"}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Edit profile — FR-AUTH-04 / FR-DRV-01                                */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+94|0)?\s?7?\d[\d ]{7,9}$/,
      "Enter a valid Sri Lankan phone number",
    ),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileScreen({
  user,
  tone = "rider",
  title = "Edit profile",
  allowDeactivate = true,
  phoneOnly = false,
  children,
}: {
  user: User;
  tone?: "rider" | "driver" | "admin";
  title?: string;
  allowDeactivate?: boolean;
  phoneOnly?: boolean;
  children?: React.ReactNode;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const [deactivate, setDeactivate] = React.useState(false);
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone ?? "" },
  });

  const onSubmit = async (v: ProfileValues) => {
    try {
      if (phoneOnly) {
        const updatedPhone = await updatePhoneNumber(v.phone);
        const updated = { ...user, phone: updatedPhone };
        setUser(updated);
        reset({ name: updated.name, phone: updated.phone ?? "" });
      } else {
        const updated = await identity.update(user.id, {
          name: v.name,
          phone: v.phone,
        });
        setUser(updated);
        reset({ name: updated.name, phone: updated.phone ?? "" });
      }
      toast.success("Profile updated", "Your details have been saved.");
    } catch (e) {
      toast.error("Update failed", errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <TopBar back={ROUTES.dashboard} title={title} />
      <ProfileHeader user={user} tone={tone} />

      <section aria-labelledby="profile-contact-title">
        <ProfileSectionTitle id="profile-contact-title">Contact details</ProfileSectionTitle>
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input label="Email" type="email" value={user.email} disabled leftIcon={<Mail size={17} />} hint="Managed by GoRide ID — contact support to change it." />
            {!phoneOnly && <Input label="Full name" leftIcon={<UserIcon size={17} />} autoComplete="name" error={errors.name?.message} {...register("name")} />}
            <Input
              label="Mobile number"
              type="tel"
              placeholder="07X XXX XXXX"
              autoComplete="tel"
              leftIcon={<Phone size={17} />}
              error={errors.phone?.message}
              hint="Sri Lankan number, e.g. 077 123 4567 or +94 77 123 4567."
              {...register("phone")}
            />
            <Button type="submit" size="lg" className="mt-1" loading={isSubmitting} loadingText="Saving…" disabled={!isDirty}>
              Save changes
            </Button>
          </form>
        </Card>
      </section>

      {children}

      <section aria-labelledby="profile-security-title">
        <ProfileSectionTitle id="profile-security-title">Sign-in &amp; security</ProfileSectionTitle>
        <Card padded={false} className="divide-y divide-line p-2">
          <ListRow icon={<KeyRound />} title="Password" description="Managed by GoRide ID. Change it from your identity provider." right={<Badge tone="neutral">GoRide ID</Badge>} />
          <ListRow icon={<LogOut />} title="Log out" description="You'll need to sign in again to use GoRide" danger onClick={() => setConfirmLogout(true)} />
        </Card>
      </section>

      {allowDeactivate && (
        <section aria-labelledby="profile-deactivate-title">
          <Card className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-danger" aria-hidden>
              <UserX size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="profile-deactivate-title" className="text-[15px] font-semibold">
                Deactivate account
              </h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted text-pretty">Your account will be disabled and you&apos;ll be signed out. Trip records are kept for audit.</p>
              <Button variant="outline" size="sm" full={false} className="mt-3 text-danger ring-danger hover:bg-red-50" onClick={() => setDeactivate(true)}>
                Deactivate
              </Button>
            </div>
          </Card>
        </section>
      )}

      <ConfirmDialog
        open={deactivate}
        onClose={() => setDeactivate(false)}
        position="fixed"
        icon={
          <DialogIcon tone="danger">
            <UserX />
          </DialogIcon>
        }
        title="Deactivate your account?"
        description="You won't be able to sign in again unless an admin reactivates you."
        confirmLabel="Deactivate"
        destructive
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await identity.deactivate(user.id);
            logout();
            router.replace(ROUTES.home);
          } catch (e) {
            toast.error("Couldn't deactivate", errorMessage(e));
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        position="fixed"
        icon={
          <DialogIcon tone="danger">
            <LogOut />
          </DialogIcon>
        }
        title="Log out of GoRide?"
        description="You'll need to sign in again to book or accept rides."
        confirmLabel="Log out"
        destructive
        onConfirm={() => {
          logout();
          router.replace(ROUTES.home);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Emergency contacts — FR-AUTH-05 (max 3)                              */
/* ------------------------------------------------------------------ */

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  relationship: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+94|0)?\s?7\d[\d ]{7,9}$/,
      "Enter a valid Sri Lankan mobile number",
    ),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
});
type ContactValues = z.infer<typeof contactSchema>;

export function EmergencyContactsSection({ user }: { user: User }) {
  const reduce = useReducedMotion();
  const [contacts, setContacts] = React.useState<EmergencyContact[] | null>(
    null,
  );
  const [open, setOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<EmergencyContact | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", relationship: "", phone: "", email: "" },
  });

  React.useEffect(() => {
    identity
      .listEmergencyContacts(user.id)
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [user.id]);

  const add = async (v: ContactValues) => {
    try {
      const c = await identity.addEmergencyContact(user.id, {
        name: v.name,
        relationship: v.relationship || undefined,
        phone: v.phone,
        email: v.email || undefined,
      });
      setContacts((prev) => [...(prev ?? []), c]);
      setOpen(false);
      reset();
      toast.success(
        "Contact added",
        `${c.name} will be alerted if you trigger SOS.`,
      );
    } catch (e) {
      toast.error("Couldn't add contact", errorMessage(e));
    }
  };

  const full = (contacts?.length ?? 0) >= 3;

  return (
    <section aria-labelledby="profile-contacts-title">
      <ProfileSectionTitle id="profile-contacts-title" right={contacts ? <span className="text-[13px] font-semibold tabular-nums text-muted">{contacts.length}/3</span> : undefined}>
        Emergency contacts
      </ProfileSectionTitle>
      <Card padded={false}>
        <div className="flex items-start gap-3 border-b border-line p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-danger" aria-hidden>
            <ShieldAlert size={18} />
          </span>
          <p className="text-[13px] leading-relaxed text-ink-2 text-pretty">
            <span className="font-semibold text-ink">When you hold SOS during a trip,</span> these contacts and our safety team get your live location, driver and vehicle details straight away.
          </p>
        </div>

        {!contacts ? (
          <div className="flex flex-col gap-2 p-3" aria-busy="true">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState icon={<PhoneCall size={22} />} title="No emergency contacts yet" description="Add someone you trust so they're alerted automatically in an emergency." compact />
        ) : (
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {contacts.map((c) => (
                <motion.li
                  key={c.id}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0, transition: fades.exit } : { opacity: 0, x: -20, transition: fades.exit }}
                  transition={fades.normal}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-snug">
                      {c.name}
                      {c.relationship && <span className="font-normal text-muted"> · {c.relationship}</span>}
                    </p>
                    <p className="truncate text-[13px] leading-snug text-muted">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                  </div>
                  <IconButton label={`Remove ${c.name}`} variant="ghost" size="icon-sm" className="text-muted hover:bg-red-50 hover:text-danger" onClick={() => setRemoving(c)}>
                    <Trash2 size={16} />
                  </IconButton>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        <div className="border-t border-line p-3">
          {open ? (
            <form onSubmit={handleSubmit(add)} className="flex flex-col gap-3 p-1" noValidate>
              <p className="text-[15px] font-semibold">Add emergency contact</p>
              <Input label="Name" placeholder="Sunil Perera" autoComplete="name" error={errors.name?.message} {...register("name")} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Relationship" placeholder="Father" error={errors.relationship?.message} {...register("relationship")} />
                <Input label="Mobile" type="tel" placeholder="07X XXX XXXX" error={errors.phone?.message} {...register("phone")} />
              </div>
              <Input label="Email (optional)" type="email" placeholder="name@example.com" error={errors.email?.message} {...register("email")} />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting} loadingText="Saving…">
                  Save contact
                </Button>
              </div>
            </form>
          ) : (
            <Button variant={full ? "secondary" : "dark"} disabled={full} leftIcon={<Plus size={18} />} onClick={() => setOpen(true)}>
              {full ? "Maximum of 3 contacts reached" : "Add contact"}
            </Button>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        position="fixed"
        title={`Remove ${removing?.name}?`}
        description="They will no longer be alerted when you trigger SOS."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          await identity.removeEmergencyContact(user.id, removing.id);
          setContacts(
            (prev) => prev?.filter((c) => c.id !== removing.id) ?? prev,
          );
          setRemoving(null);
        }}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Notification preferences — FR-AUTH-07                                */
/* ------------------------------------------------------------------ */

export function NotificationPrefsSection({ user }: { user: User }) {
  const [prefs, setPrefs] = React.useState<NotificationPreferences | null>(
    null,
  );

  React.useEffect(() => {
    identity
      .getNotificationPreferences(user.id)
      .then(setPrefs)
      .catch(() => {});
  }, [user.id]);

  const update = async (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      setPrefs(await identity.updateNotificationPreferences(user.id, patch));
    } catch (e) {
      setPrefs(previous);
      toast.error("Couldn't save", errorMessage(e));
    }
  };

  return (
    <section aria-labelledby="profile-notifications-title">
      <ProfileSectionTitle id="profile-notifications-title">Notifications</ProfileSectionTitle>
      {!prefs ? (
        <Skeleton className="h-44 rounded-card" />
      ) : (
        <Card padded={false} className="divide-y divide-line">
          <div className="p-4">
            <Toggle
              checked={prefs.pushEnabled}
              onChange={(v) => update({ pushEnabled: v })}
              label="Push notifications"
              description="Driver accepted, arrived, trip completed, payment received"
            />
          </div>
          <div className="p-4">
            <Toggle
              checked={prefs.emailEnabled}
              onChange={(v) => update({ emailEnabled: v })}
              label="Email"
              description="Receipts and account security messages"
            />
          </div>
          <div className="p-4">
            <Toggle
              checked={prefs.smsEnabled}
              onChange={(v) => update({ smsEnabled: v })}
              label="SMS"
              description="Critical alerts only (carrier charges may apply)"
            />
          </div>
        </Card>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-muted text-pretty">
        SOS alerts to admin and your emergency contacts are always delivered
        regardless of these settings.
      </p>
    </section>
  );
}
