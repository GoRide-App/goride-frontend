/**
 * Client helper for interacting with the goride-notification microservice.
 * Handles device FCM push token registration for riders.
 */

const NOTIFICATION_API_URL = process.env.NEXT_PUBLIC_NOTIFICATION_API_URL ?? "http://localhost:8083";

export interface RegisterDeviceTokenPayload {
  riderId: string;
  token: string;
}

/**
 * Registers an FCM push token with the goride-notification backend for a rider.
 * @param payload Rider ID and FCM token string.
 */
export async function registerDeviceToken(payload: RegisterDeviceTokenPayload): Promise<boolean> {
  try {
    const baseUrl = NOTIFICATION_API_URL.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/notifications/device-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`[Notification] Failed to register device token (${res.status})`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Notification] Network error registering device token:", err);
    return false;
  }
}
