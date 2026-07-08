/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module — keep it out of the bundle so its
  // compiled binary is required from node_modules at runtime.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
