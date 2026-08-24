"use client";
import { MeResponse, getMe } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((me) => {
        if (!me) {
          router.push("/"); // not logged in at all
          return;
        }
        console.log(me)
        if (me.roles.length === 0) {
          router.push("/onboarding/select-role"); // logged in, no role yet
          return;
        }
        setUser(me);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <p>Loading...</p>;
  if (!user) return null; // redirecting

  return (
    <main>
      <h1>Welcome, {user.name}</h1>
      <p>Roles: {user.roles.join(", ")}</p>
      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/logout`}
      >
        Log Out
      </a>
    </main>
  );
}
