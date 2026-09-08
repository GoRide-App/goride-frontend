import type { DriverProfile, Session, User, VehicleTypeCode } from "@/types";
import { useAuthStore } from "@/lib/auth/session";
import { normalizeRole } from "@/lib/constants";
import type { GoRideApi } from "./contract";
import { httpApi } from "./http";
import { mockApi } from "@/lib/mock/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TRIP_API_URL = process.env.NEXT_PUBLIC_TRIP_API_URL ?? "http://localhost:8080";

export const API_MODE: "mock" | "http" = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";
export const IS_MOCK = API_MODE === "mock";
export const api: GoRideApi = IS_MOCK ? mockApi : httpApi;

export type { GoRideApi, TripEvent, RegisterPayload, CreateTripPayload, DriverTripAction } from "./contract";

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
  if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") return (e as Error).message;
  return fallback;
}



/* ------------------------------------------------------------------ */
/* Identity & Auth integration (goride-identity-auth)                   */
/* ------------------------------------------------------------------ */

export interface MeResponse {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
}

export type DriverVehiclePayload = {
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleTypeCode: VehicleTypeCode;
  licenseNumber: string;
  licenseExpiry: string;
};

function readStringValue(raw: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      const nested = readStringValue(candidate, ["value", "status", "name"], "");
      if (nested) return nested;
    }
  }
  return fallback;
}

function readBooleanValue(raw: Record<string, unknown>, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      const nested = readBooleanValue(candidate, ["value", "enabled", "is_active"], fallback);
      if (nested !== fallback || Object.hasOwn(candidate, "value")) return nested;
    }
  }
  return fallback;
}

function normalizeDriverStatus(status: unknown): DriverProfile["status"] {
  const raw = typeof status === "string" ? status : status && typeof status === "object" ? (status as Record<string, unknown>) : null;
  const candidate = raw ? readStringValue(raw as Record<string, unknown>, ["value", "status", "name"], "PendingVerification") : "PendingVerification";
  const normalized = candidate.trim();
  const valid = ["PendingVerification", "DocumentReview", "Active", "Rejected", "Suspended", "Deactivated", "Offline"] as const;
  return valid.includes(normalized as (typeof valid)[number]) ? (normalized as DriverProfile["status"]) : "PendingVerification";
}


function buildSessionFromMe(me: MeResponse): Session {
  const primaryRole = (me.roles.map((value) => normalizeRole(value)).find(Boolean) as User["role"] | undefined) ?? "Rider";

  const user: User = {
    id: me.userId,
    name: me.name,
    email: me.email,
    phone: me.phone,
    role: primaryRole,
    emailVerified: true,
    phoneVerified: false,
    rating: 5,
    ratingCount: 0,
    createdAt: new Date().toISOString(),
  };

  return {
    user,
    accessToken: "",
    expiresAt: Date.now() + 60 * 60 * 1000,
    provider: "oidc",
  };
}

export async function getMe(): Promise<MeResponse | null> {
  const session = useAuthStore.getState().session;
  if (session?.provider === "local") {
    return {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone ?? null,
      roles: [session.user.role],
    };
  }

  if (!API_URL) return null;

  const res = await fetch(`${API_URL}/api/me`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch user");

  const raw = (await res.json()) as MeResponse & {
    phoneNumber?: string | null;
    phone_number?: string | null;
  };
  const me: MeResponse = {
    ...raw,
    phone: raw.phone ?? raw.phoneNumber ?? raw.phone_number ?? null,
  };
  useAuthStore.getState().setSession(buildSessionFromMe(me));
  return me;
}

export async function selectRole(role: "Driver" | "Rider"): Promise<void> {
  const res = await fetch(`${API_URL}/api/onboarding/select-role`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) throw new Error("Failed to assign role");
}