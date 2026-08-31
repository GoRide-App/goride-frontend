const API_URL = process.env.NEXT_PUBLIC_API_URL;

import type { DriverProfile, DriverStatus, Session, User, VehicleTypeCode } from "@/types";
import { useAuthStore } from "@/lib/auth/session";
import { normalizeRole } from "@/lib/constants";

export interface MeResponse {
  userId: string;
  name: string;
  email: string;
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

function readStringValue(
  raw: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      const nested = readStringValue(
        candidate,
        ["value", "status", "name"],
        "",
      );
      if (nested) return nested;
    }
  }
  return fallback;
}

function readBooleanValue(
  raw: Record<string, unknown>,
  keys: string[],
  fallback = false,
): boolean {
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
      const nested = readBooleanValue(
        candidate,
        ["value", "enabled", "is_active"],
        fallback,
      );
      if (nested !== fallback || Object.hasOwn(candidate, "value"))
        return nested;
    }
  }
  return fallback;
}

function normalizeDriverStatus(status: unknown): DriverProfile["status"] {
  const raw =
    typeof status === "string"
      ? status
      : status && typeof status === "object"
        ? (status as Record<string, unknown>)
        : null;

  const candidate = raw
    ? readStringValue(
        raw as Record<string, unknown>,
        ["value", "status", "name"],
        "PendingVerification",
      )
    : "PendingVerification";
  const normalized = candidate.trim();
  const valid = [
    "PendingVerification",
    "DocumentReview",
    "Active",
    "Rejected",
    "Suspended",
    "Deactivated",
    "Offline",
  ] as const;

  return valid.includes(normalized as (typeof valid)[number])
    ? (normalized as DriverProfile["status"])
    : "PendingVerification";
}

function normalizeDriverProfile(
  raw: Record<string, unknown>,
  fallbackDriverId?: string,
): DriverProfile {
  const vehicleTypeCode = readStringValue(
    raw,
    ["vehicle_type_code", "vehicleTypeCode"],
    "CAR",
  ) as DriverProfile["vehicleTypeCode"];
  const safeVehicleTypeCode = ["BIKE", "TUK", "CAR", "XL"].includes(
    vehicleTypeCode,
  )
    ? vehicleTypeCode
    : "CAR";

  return {
    driverId: readStringValue(
      raw,
      ["driver_id", "driverId"],
      fallbackDriverId ?? "",
    ),
    vehicleMake: readStringValue(raw, ["vehicle_make", "vehicleMake"], ""),
    vehicleModel: readStringValue(raw, ["vehicle_model", "vehicleModel"], ""),
    vehiclePlate: readStringValue(raw, ["vehicle_plate", "vehiclePlate"], ""),
    vehicleColor: readStringValue(raw, ["vehicle_color", "vehicleColor"], ""),
    vehicleTypeCode: safeVehicleTypeCode,
    licenseNumber: readStringValue(
      raw,
      ["license_number", "licenseNumber"],
      "",
    ),
    licenseExpiry: readStringValue(
      raw,
      ["license_expiry", "licenseExpiry"],
      new Date().toISOString(),
    ),
    status: normalizeDriverStatus(
      raw.status ??
        raw.profileStatus ??
        raw.statusValue ??
        "PendingVerification",
    ),
    verifiedAt: readStringValue(raw, ["verified_at", "verifiedAt"], "") || null,
    online: readBooleanValue(raw, ["online", "is_online"], false),
  };
}

function driverProfileFromResponse(
  response: Partial<DriverProfile> | null,
  values: DriverVehiclePayload,
): DriverProfile {
  const parsed = (response ?? {}) as Record<string, unknown>;
  const normalized = {
    ...parsed,
    driverId: parsed.driverId ?? parsed.driver_id ?? "",
    vehicleMake:
      parsed.vehicleMake ?? parsed.vehicle_make ?? values.vehicleMake,
    vehicleModel:
      parsed.vehicleModel ?? parsed.vehicle_model ?? values.vehicleModel,
    vehiclePlate:
      parsed.vehiclePlate ?? parsed.vehicle_plate ?? values.vehiclePlate,
    vehicleColor: parsed.vehicleColor ?? parsed.vehicle_color ?? "",
    vehicleTypeCode: (parsed.vehicleTypeCode ??
      parsed.vehicle_type_code ??
      values.vehicleTypeCode) as DriverProfile["vehicleTypeCode"],
    licenseNumber:
      parsed.licenseNumber ?? parsed.license_number ?? values.licenseNumber,
    licenseExpiry:
      parsed.licenseExpiry ?? parsed.license_expiry ?? values.licenseExpiry,
    status:
      parsed.status ??
      parsed.profileStatus ??
      parsed.statusValue ??
      "PendingVerification",
    verifiedAt: parsed.verifiedAt ?? parsed.verified_at ?? null,
    online: parsed.online ?? parsed.is_online ?? false,
  };

  return normalizeDriverProfile(normalized, values.vehiclePlate);
}

// async function driverProfileRequest(
//   url: string,
//   values: DriverVehiclePayload,
// ): Promise<DriverProfile> {
//   const res = await fetch(url, {
//     method: "POST",
//     credentials: "include",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(values),
//   });

//   if (!res.ok) throw new Error("Failed to save vehicle details");

//   const text = await res.text();
//   const response = text ? (JSON.parse(text) as Partial<DriverProfile>) : null;
//   return driverProfileFromResponse(response, values);
// }

// export function addDriverProfile(
//   values: DriverVehiclePayload,
// ): Promise<DriverProfile> {
//   return driverProfileRequest(`${API_URL}/api/driver/addProfile`, values);
// }

// export function updateDriverProfile(
//   sub: string,
//   values: DriverVehiclePayload,
// ): Promise<DriverProfile> {
//   return driverProfileRequest(`${API_URL}/api/driver/update/${sub}`, values);
// }

async function driverProfileRequest(
  url: string,
  values: DriverVehiclePayload,
  method: "POST" | "PUT" = "POST",
): Promise<DriverProfile> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  if (!res.ok) throw new Error("Failed to save vehicle details");

  const text = await res.text();
  const response = text ? (JSON.parse(text) as Partial<DriverProfile>) : null;
  return driverProfileFromResponse(response, values);
}

export function addDriverProfile(
  values: DriverVehiclePayload,
): Promise<DriverProfile> {
  return driverProfileRequest(`${API_URL}/api/driver/addProfile`, values, "POST");
}

export function updateDriverProfile(
  sub: string,
  values: DriverVehiclePayload,
): Promise<DriverProfile> {
  return driverProfileRequest(`${API_URL}/api/driver/update/${sub}`, values, "PUT");
}

function buildSessionFromMe(me: MeResponse): Session {
  const primaryRole =
    (me.roles.map((value) => normalizeRole(value)).find(Boolean) as
      | User["role"]
      | undefined) ?? "Rider";

  const user: User = {
    id: me.userId,
    name: me.name,
    email: me.email,
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
  if (session) {
    return {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      roles: [session.user.role],
    };
  }

  if (!API_URL) return null;

  try {
    const res = await fetch(`${API_URL}/api/me`, {
      credentials: "include", // sends the app_session cookie cross-origin
      cache: "no-store",
    });

    if (res.status === 401) return null;
    if (!res.ok) return null;

    const me = (await res.json()) as MeResponse;
    useAuthStore.getState().setSession(buildSessionFromMe(me));
    return me;
  } catch (err) {
    console.error("Failed to fetch user session from backend:", err);
    return null;
  }
}

export async function getDriverProfile(
  sub: string,
): Promise<DriverProfile | null> {
  if (!API_URL) return null;

  const res = await fetch(`${API_URL}/api/driver/${sub}`, {
    credentials: "include",
  });

  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch driver profile");

  const text = await res.text();
  const payload = text
    ? (JSON.parse(text) as Partial<DriverProfile> & Record<string, unknown>)
    : null;
  return payload ? normalizeDriverProfile(payload, sub) : null;
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

export async function updatePhoneNumber(phoneNumber: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/profile`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });

  if (!res.ok) throw new Error("Failed to update phone number");
}

/* ------------------------------------------------------------------ */
/* Admin Driver Account Management                                     */
/* ------------------------------------------------------------------ */

export interface DriverAccountAdminDto {
  driverId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleTypeCode: VehicleTypeCode;
  licenseNumber: string;
  licenseExpiry: string;
  status: DriverStatus;
  statusReason?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getAdminDrivers(
  status?: string,
): Promise<DriverAccountAdminDto[]> {
  if (!API_URL) return [];
  const url = new URL(`${API_URL}/api/admin/drivers`);
  if (status && status !== "all" && status !== "queue") {
    url.searchParams.set("status", status);
  }
  const res = await fetch(url.toString(), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch driver accounts");
  return (await res.json()) as DriverAccountAdminDto[];
}

export async function getAdminDriverById(
  driverId: string,
): Promise<DriverAccountAdminDto | null> {
  if (!API_URL) return null;
  const res = await fetch(
    `${API_URL}/api/admin/drivers/${encodeURIComponent(driverId)}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch driver details");
  return (await res.json()) as DriverAccountAdminDto;
}

export async function updateAdminDriverStatus(
  driverId: string,
  status: DriverStatus,
  reason: string,
): Promise<DriverAccountAdminDto> {
  if (!API_URL) throw new Error("API URL is not configured");
  const res = await fetch(
    `${API_URL}/api/admin/drivers/${encodeURIComponent(driverId)}/status`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    },
  );
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || "Failed to update driver status");
  }
  return (await res.json()) as DriverAccountAdminDto;
}
