/**
 * Custom production server for Hostinger's hPanel "Node.js App" (LiteSpeed).
 *
 * WHY THIS EXISTS
 * ---------------
 * hPanel shared hosting doesn't run `npm start`. It launches ONE startup file
 * (set this file as the "Application startup file") and expects the app to
 * listen on the PORT / socket it injects via the environment. Plain
 * `next start` tends to bind port 3000 and never latch onto the LiteSpeed
 * socket, so the proxy can't reach it and shows a 503 "Service Unavailable" —
 * even though Next keeps printing "Starting…". This file starts Next
 * programmatically and binds to exactly what Hostinger provides.
 *
 * It listens on:
 *   - process.env.PORT  — a TCP port number, OR a unix-socket path (hPanel may
 *                         hand over either; both are handled below), else 3000.
 *
 * Run `npm run build` before starting (Hostinger's "Build" / npm install step),
 * because this serves the production build from .next.
 */
const { createServer } = require("node:http");
const next = require("next");

const app = next({ dev: false });
const handle = app.getRequestHandler();

// hPanel usually sets PORT. It's normally a number, but LiteSpeed can pass a
// unix-socket path instead — listen() accepts either, so pass it through as-is.
const rawPort = process.env.PORT || "3000";
const port = /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort;
const host = "0.0.0.0";

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      // Never let a single bad request take the whole process down (a crash
      // here is what turns into a restart loop on hPanel).
      handle(req, res).catch((err) => {
        console.error("[server] request failed:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
    });

    // Numeric port → bind host:port. Socket path → bind the socket directly.
    if (typeof port === "number") {
      server.listen(port, host, () => {
        console.log(`✓ Ready on http://${host}:${port}`);
      });
    } else {
      server.listen(port, () => {
        console.log(`✓ Ready on socket ${port}`);
      });
    }

    server.on("error", (err) => {
      console.error("[server] listen error:", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    // A failure in prepare() (bad build, missing file, etc.) must be loud, not a
    // silent restart loop.
    console.error("[server] failed to start Next.js:", err);
    process.exit(1);
  });

// Surface the errors hPanel otherwise swallows, so the app log shows the real
// cause instead of an endless "Starting…".
process.on("unhandledRejection", (err) => {
  console.error("[server] unhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
});
