"use client";

import { useState } from "react";
import { selectRole } from "../../../lib/api";

export default function SelectRole() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(role: "Driver" | "Rider") {
    setSubmitting(true);
    setError(null);
    try {
      await selectRole(role);
      // Force a fresh OIDC round-trip so the new roles claim
      // gets baked into a new token/cookie. Asgardeo's own session
      // is still active, so this is silent - no login prompt shown.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/login?returnUrl=http://localhost:3000/dashboard`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Are you a Rider or a Driver?</h1>
      <button disabled={submitting} onClick={() => handleSelect("Rider")}>
        I am a Rider
      </button>
      <br/><br/>
      <button disabled={submitting} onClick={() => handleSelect("Driver")}>
        I am a Driver
      </button>
      {error && <p>{error}</p>}
    </main>
  );
}