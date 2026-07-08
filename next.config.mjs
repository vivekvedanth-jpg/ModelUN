/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // sql.js loads its .wasm binary from disk at runtime (see
    // lib/server/sqlite-store.ts). Keep it external so webpack doesn't try to
    // bundle the WASM, and make sure the .wasm file is copied into the traced
    // server output so it exists on the host regardless of the launch cwd.
    serverComponentsExternalPackages: ["sql.js"],
    outputFileTracingIncludes: {
      "*": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
    },
  },
};

export default nextConfig;
