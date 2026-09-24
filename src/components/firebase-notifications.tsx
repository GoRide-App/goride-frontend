"use client";

import { useEffect } from "react";
import { requestFirebaseToken, onMessageListener } from "@/lib/firebase";
import { registerDeviceToken } from "@/lib/api/notification";
import { useCurrentUser } from "@/components/layout/role-guard";
import { toast } from "@/components/ui/toast";

export function FirebaseNotifications() {
  const user = useCurrentUser();

  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;

    async function initFirebase() {
      try {
        const token = await requestFirebaseToken();
        if (token && isSubscribed) {
          // Register token with backend
          await registerDeviceToken(user.id, token).catch(e => console.warn("Failed to register token", e));
        }
      } catch (err) {
        console.error("Firebase init failed:", err);
      }
    }

    initFirebase();

    // Set up foreground message listener
    const listen = async () => {
      try {
        const payload: any = await onMessageListener();
        if (payload?.notification) {
          toast.notify(payload.notification.title, payload.notification.body);
        }
        if (isSubscribed) {
          listen();
        }
      } catch (err) {
        console.error("FCM listener error", err);
      }
    };

    listen();

    return () => {
      isSubscribed = false;
    };
  }, [user]);

  return null;
}
