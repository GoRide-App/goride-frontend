const NOTIFICATION_API_URL = (process.env.NEXT_PUBLIC_NOTIFICATION_API_URL ?? "https://localhost:7136").replace(/\/+$/, "");

export async function registerDeviceToken(riderId: string, token: string): Promise<void> {
  const res = await fetch(`${NOTIFICATION_API_URL}/api/notifications/device-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ riderId, token }),
  });
  if (!res.ok) {
    throw new Error(`Failed to register device token (${res.status})`);
  }
}
