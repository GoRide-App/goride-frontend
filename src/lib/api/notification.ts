import { getAccessToken } from "@/lib/auth/session";

// goride-notification's docker-compose maps 8083 -> 8080; that's the default here, matching
// how NEXT_PUBLIC_TRIP_API_URL defaults to trip-matching's own docker-compose port elsewhere.
const NOTIFICATION_API_URL = (process.env.NEXT_PUBLIC_NOTIFICATION_API_URL ?? "http://localhost:8083").replace(/\/+$/, "");

export async function registerDeviceToken(riderId: string, token: string): Promise<void> {
  const accessToken = getAccessToken();
  const res = await fetch(`${NOTIFICATION_API_URL}/api/notifications/device-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({ riderId, token }),
  });
  if (!res.ok) {
    throw new Error(`Failed to register device token (${res.status})`);
  }
}
