"use client";

import { useEffect } from "react";
import { requestFirebaseToken, setupMessageListener } from "@/lib/firebase";
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
        if (token && isSubscribed && user) {
          // Register token with backend
          await registerDeviceToken(user.id, token).catch(e => console.warn("Failed to register token", e));
        }
      } catch (err) {
        console.error("Firebase init failed:", err);
      }
    }

    initFirebase();

    let unsubscribeMessageListener: (() => void) | undefined;
    
    // Set up foreground message listener
    unsubscribeMessageListener = setupMessageListener((payload: any) => {
      if (payload?.notification) {
        toast.notify(payload.notification.title, payload.notification.body);
      }
    });

    return () => {
      isSubscribed = false;
      if (unsubscribeMessageListener) {
        unsubscribeMessageListener();
      }
    };
  }, [user]);

  return null;
}
