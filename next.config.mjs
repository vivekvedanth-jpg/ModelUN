/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sql.js loads its .wasm binary from disk at runtime (see lib/server/sqlite-store.ts) —
  // keep it out of the webpack bundle so that file path resolution stays intact.
  experimental: {
    serverComponentsExternalPackages: ["sql.js"],
  },
};

export default nextConfig;
