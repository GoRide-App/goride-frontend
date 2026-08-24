import { cookies } from "next/headers";

async function getUser() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function Dashboard() {
  const user = await getUser();
  if (!user)
    return (
      <p>
        Not logged in. <a href="/">Go back</a>
      </p>
    );

  return (
    <main>
      <h1>Welcome, {user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Roles: {user.roles.join(", ") || "none"}</p>
      <div></div>
      <div>
        <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/logout?returnUrl=http://localhost:3000`}
      >
        Log out
      </a>
      </div>
    </main>
  );
}
