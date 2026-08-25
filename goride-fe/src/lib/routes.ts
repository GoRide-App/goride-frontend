import type { Role } from "@/types/auth";

/** Single source of truth for app paths — no hard-coded strings in pages. */
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
  selectRole: "/onboarding/select-role",
  rider: {
    home: "/dashboard",
    profile: "/rider/profile",
  },
  driver: {
    home: "/dashboard",
    profile: "/driver/profile",
  },
  admin: {
    home: "/dashboard",
    profile: "/admin/profile",
  },
} as const;

/** Where a user lands straight after signing in. */
export function homeForRole(role: Role | undefined): string {
  switch (role) {
    case "Driver":
      return ROUTES.driver.home;
    case "Admin":
      return ROUTES.admin.home;
    case "Rider":
      return ROUTES.rider.home;
    default:
      return ROUTES.selectRole;
  }
}
