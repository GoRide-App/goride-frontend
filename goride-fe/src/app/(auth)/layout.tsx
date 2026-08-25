import type { ReactNode } from "react";
import AuthShell from "@/components/layout/auth-shell";

/** Route group for every unauthenticated screen: /login, /signup, ... */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
