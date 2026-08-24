const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface MeResponse {
  name: string;
  email: string;
  roles: string[];
}

export async function getMe(): Promise<MeResponse | null> {
  const res = await fetch(`${API_URL}/api/me`, {
    credentials: 'include', // sends the app_session cookie cross-origin
  });

  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to fetch user');

  return res.json();
}

export async function selectRole(role: 'Driver' | 'Rider'): Promise<void> {
  const res = await fetch(`${API_URL}/api/onboarding/select-role`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) throw new Error('Failed to assign role');
}