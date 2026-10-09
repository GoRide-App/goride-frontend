import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  /* Keep Next from writing agent instruction files into the repo. */
  agentRules: false,

  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "https://localhost:7136";
    // goride-payment reads the same app_session cookie, so it is proxied same-origin too.
    const payment = process.env.PAYMENT_URL ?? "http://localhost:8084";
    return [
      { source: "/payments/:path*", destination: `${payment}/payments/:path*` },
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/login", destination: `${backend}/login` },
      { source: "/logout", destination: `${backend}/logout` },
      { source: "/signin-oidc", destination: `${backend}/signin-oidc` },
      { source: "/signout-callback-oidc", destination: `${backend}/signout-callback-oidc` },
    ];
  },
};

export default nextConfig;