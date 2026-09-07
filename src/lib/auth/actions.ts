"use client";

import type { RegisterPayload, Session, User } from "@/types";
import { identity } from "./identity-store";
import { useAuthStore } from "./session";

export async function loginWithPassword(email: string, password: string): Promise<Session> {
  const session = await identity.login(email, password);
  useAuthStore.getState().setSession(session);
  return session;
}

export async function registerAccount(payload: RegisterPayload): Promise<Session> {
  const session = await identity.register(payload);
  useAuthStore.getState().setSession(session);
  return session;
}

// export function logout() {
//   useAuthStore.getState().setSession(null);
// }
export async function logout() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "[GoRide] NEXT_PUBLIC_API_URL is not set — cannot redirect to identity logout.",
    );
    // Still clear the local session so the user isn't stuck in a signed-in
    // state on the client even if the server-side cookie can't be cleared.
    useAuthStore.getState().setSession(null);
    return;
  }
  useAuthStore.getState().setSession(null);
  const cleanApiUrl = apiUrl.replace(/\/+$/, "");
  window.location.href = `${cleanApiUrl}/logout`;
}

export async function refreshCurrentUser(): Promise<User | null> {
  const st = useAuthStore.getState();
  if (!st.session) return null;
  try {
    const user = await identity.get(st.session.user.id);
    st.setUser(user);
    return user;
  } catch {
    return st.session.user;
  }
}
