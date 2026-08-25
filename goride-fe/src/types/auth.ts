/**
 * Shared auth + profile types.
 *
 * Structure only — field names follow the API contract we agreed on for the
 * auth sprint. Extend/replace as the real endpoints land.
 */

export type Role = "Rider" | "Driver" | "Admin";

export type VehicleTypeCode = "BIKE" | "TUK" | "CAR" | "XL";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roles: Role[];
  emailVerified?: boolean;
  profilePhotoUrl?: string;
}

/** POST /auth/login */
export interface LoginValues {
  email: string;
  password: string;
}

/** POST /auth/register — step 1 (everyone) */
export interface SignupValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Exclude<Role, "Admin">;
  /** Present only when role === "Driver" (signup step 2). */
  vehicle?: VehicleValues;
}

/** POST /auth/register — step 2 (drivers only) */
export interface VehicleValues {
  make: string;
  model: string;
  plate: string;
  color: string;
  typeCode: VehicleTypeCode;
  licenseNumber: string;
  licenseExpiry: string;
}

/** PATCH /users/:id — the editable slice of the profile pages */
export interface ProfileValues {
  name: string;
  phone: string;
}
