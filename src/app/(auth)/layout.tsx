import type { ReactNode } from "react";
import AuthFrame from "@/components/layout/auth-frame";

/** Route group for every unauthenticated screen: /login, /signup. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthFrame tone="auth">{children}</AuthFrame>;
}
