/**
 * Client helper for interacting with the goride-notification microservice.
 * Handles FCM device push token registrations, notification preference management, and trip notification triggers.
 */

const NOTIFICATION_API_URL = process.env.NEXT_PUBLIC_NOTIFICATION_API_URL ?? "http://localhost:8083";

export interface RegisterDeviceTokenPayload {
  riderId: string;
  token: string;
}

export interface DriverArrivalNotificationPayload {
  tripId: string;
  riderId: string;
  driverName?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  currentState: string;
}

export interface TripCompletedNotificationPayload {
  tripId: string;
  riderId: string;
  driverName?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  fare?: number;
  currentState: string;
}

export interface PaymentConfirmedNotificationPayload {
  tripId: string;
  riderId: string;
  fare: number;
}

export interface NotificationTriggerResult {
  success: boolean;
  status: number;
  message: string;
  nextState?: string;
  channels?: string[];
  conflict?: boolean;
}

export interface UserNotificationPreferences {
  riderId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

/**
 * Registers an FCM push token with the goride-notification backend for a rider.
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

/**
 * Triggers driver arrival notification and handles trip state transition validation (SCRUM-128).
 */
export async function triggerDriverArrivalNotification(
  payload: DriverArrivalNotificationPayload
): Promise<NotificationTriggerResult> {
  try {
    const baseUrl = NOTIFICATION_API_URL.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/notifications/trip/driver-arrived`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      return {
        success: false,
        status: 409,
        conflict: true,
        message: data.message ?? "Trip is not in a valid state for driver arrival notification.",
      };
    }

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data.message ?? `Failed to trigger driver arrival notification (${res.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      message: data.message ?? "Driver arrival notification dispatched successfully",
      nextState: data.nextState ?? "DRIVER_ARRIVED",
    };
  } catch (err) {
    console.error("[Notification] Error triggering driver arrival notification:", err);
    return {
      success: false,
      status: 500,
      message: "Network connection error while sending driver arrival notification.",
    };
  }
}

/**
 * Triggers ride completion notification and handles trip state transition validation (SCRUM-129).
 */
export async function triggerTripCompletedNotification(
  payload: TripCompletedNotificationPayload
): Promise<NotificationTriggerResult> {
  try {
    const baseUrl = NOTIFICATION_API_URL.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/notifications/trip/completed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      return {
        success: false,
        status: 409,
        conflict: true,
        message: data.message ?? "Trip is not in a valid state for ride completion notification.",
      };
    }

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data.message ?? `Failed to trigger ride completion notification (${res.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      message: data.message ?? "Ride completion notification dispatched successfully",
      nextState: data.nextState ?? "TRIP_COMPLETED",
    };
  } catch (err) {
    console.error("[Notification] Error triggering ride completion notification:", err);
    return {
      success: false,
      status: 500,
      message: "Network connection error while sending ride completion notification.",
    };
  }
}

/**
 * Triggers payment confirmation notification over enabled channels (Push & Email) (SCRUM-130).
 */
export async function triggerPaymentConfirmationNotification(
  payload: PaymentConfirmedNotificationPayload
): Promise<NotificationTriggerResult> {
  try {
    const baseUrl = NOTIFICATION_API_URL.replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/notifications/trip/payment-confirmed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data.message ?? `Failed to trigger payment confirmation notification (${res.status})`,
      };
    }

    return {
      success: true,
      status: 200,
      message: data.message ?? "Payment confirmation notifications dispatched successfully",
      channels: data.channels ?? ["push", "email"],
    };
  } catch (err) {
    console.error("[Notification] Error triggering payment confirmation notification:", err);
    return {
      success: false,
      status: 500,
      message: "Network connection error while sending payment confirmation notification.",
    };
  }
}
