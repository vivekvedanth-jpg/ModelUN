/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // sql.js loads its .wasm binary from disk at runtime (see
    // lib/server/sqlite-store.ts). Keep it external so webpack doesn't try to
    // bundle the WASM, and make sure the .wasm file is copied into the traced
    // server output so it exists on the host regardless of the launch cwd.
    // sanitize-html pulls in the ESM-only htmlparser2, which webpack can't
    // bundle server-side — keep it external so Node loads it natively.
    serverComponentsExternalPackages: ["sql.js", "sanitize-html"],
    outputFileTracingIncludes: {
      "*": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
    },
  },
};

export default nextConfig;
