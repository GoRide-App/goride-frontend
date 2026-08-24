export default function Home() {
  return (
    <main>
      <h1>Go-Ride</h1>
      <a
        href={`${process.env.NEXT_PUBLIC_API_URL}/login?returnUrl=http://localhost:3000/dashboard`}
      >
        Log in
      </a>
    </main>
  );
}
