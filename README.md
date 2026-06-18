# ModelUN — Learning Platform

A Model United Nations learning web app built with **Next.js (App Router)**,
**Tailwind CSS**, and a **mocked localStorage backend**.

> **Phase 1 — Core Layout & Authentication**
> Landing page · Sign In (no public sign-up) · role-based access
> (Owner / Admin / Normal) · responsive navigation · feature pages (Videos,
> Resources + Q&A, Timer, Model Diplomat) · Admin Dashboard with account
> management and upload controls.

---

## 1. Prerequisites — install Node.js

This machine doesn't have Node yet. You need **Node.js 18.18 or newer** (which
includes `npm`). Pick one option:

**Option A — official installer (easiest)**
Download the **LTS** installer from <https://nodejs.org> and run it.

**Option B — Homebrew**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

Verify it worked (open a fresh terminal):
```bash
node -v   # should print v18.18+ or v20+
npm -v
```

---

## 2. Open the project in VS Code

```bash
cd "/Users/vivekvedanth/Library/Mobile Documents/com~apple~CloudDocs/My Model United Nations Project"
code .
```

When VS Code asks, click **"Install recommended extensions"** (Tailwind CSS
IntelliSense, ESLint, Prettier) for the best experience.

---

## 3. Install dependencies & run

In the VS Code integrated terminal (**Terminal → New Terminal**):

```bash
npm install      # first time only — downloads Next, React, Tailwind, etc.
npm run dev      # starts the dev server
```

Open **<http://localhost:3000>** in your browser. Edits hot-reload automatically.

Other scripts:
```bash
npm run build    # production build
npm run start    # run the production build
npm run lint     # lint the project
```

---

## 4. Try the authentication

| Role       | How to get it                                                                          |
| ---------- | -------------------------------------------------------------------------------------- |
| **Owner**  | The permanent account — seeded automatically. Email `admin1@mun.app`, password `33cat`. |
| **Admin**  | Created by the Owner from the Admin Dashboard → *Create an account → Admin*.             |
| **Normal** | Created by any admin (or the Owner) from the Admin Dashboard. No public sign-up.         |

> Sign in is by **email + password**. Accounts are identified by email.

- **No public sign-up.** `/signup` redirects to `/signin`; accounts exist only
  if an admin creates them.
- **The Owner (`Admin1`)** is the only role that can **promote** delegates to
  Admin, **demote** Admins, or **delete** Admin accounts. Regular admins can
  only create and delete `normal` delegate accounts.
- **Normal** users see: Home · Videos · Resources (with **Q&A**) · Timer ·
  Model Diplomat. On Resources they can post **public or private** questions.
- **Admins / Owner** also get an Admin Dashboard (account management + content
  stats), upload controls, the ability to **delete** videos/resources, and can
  answer/delete any Q&A question.

Accounts and your current session live in the browser's **localStorage**. To
reset everything, clear site data for `localhost` (or run
`localStorage.clear()` in the browser console).

---

## 5. Project structure

```
.
├── app/                      # App Router pages
│   ├── layout.tsx            # Root layout: fonts, AuthProvider, Navbar, Footer
│   ├── globals.css           # Tailwind + reusable component classes
│   ├── page.tsx              # Landing page
│   ├── signin/page.tsx       # Sign In
│   ├── signup/page.tsx       # Redirects to /signin (no public sign-up)
│   ├── videos/page.tsx       # Videos (protected)
│   ├── resources/page.tsx    # Resources (protected)
│   ├── timer/page.tsx        # Caucus timer (protected)
│   ├── model-diplomat/page.tsx  # AI practice preview (protected)
│   └── admin/page.tsx        # Admin Dashboard (admin only)
├── components/
│   ├── AuthProvider.tsx      # React context: user, signIn, signOut
│   ├── Navbar.tsx            # Responsive, role-based navigation
│   ├── Footer.tsx
│   ├── Protected.tsx         # Client-side route guard
│   ├── AdminOnly.tsx         # Renders children only for admins/owner
│   ├── AuthShell.tsx         # Shared layout for auth pages
│   ├── PageHeader.tsx        # Shared page hero
│   ├── UploadCard.tsx        # Admin publish control (writes to content store)
│   ├── AccountManager.tsx    # Create / promote / demote / delete accounts
│   ├── ResourceLibrary.tsx   # Resources list + admin upload/delete
│   ├── VideoLibrary.tsx      # Videos list + admin upload/delete
│   ├── QASection.tsx         # Public/private questions + admin answers
│   ├── CaucusTimer.tsx       # Functional MUN timer
│   ├── AdminDashboard.tsx    # Admin dashboard UI
│   └── icons.tsx             # Inline SVG icon set
├── lib/
│   ├── auth.ts               # Mocked auth + account management (seeds Owner)
│   ├── content.ts            # Videos + resources store (seeds real UN docs)
│   ├── qa.ts                 # Q&A store (public/private questions)
│   ├── experience.ts         # Per-delegate MUN experience / scorecards
│   └── contact.ts            # Contact-form queries (recipient hidden here)
└── (config: package.json, tsconfig.json, tailwind.config.ts, …)
```

Additional pages: `/experience` (My MUN Experience — log conferences,
committee, placement, scorecard), `/settings` (change email / password), and a
public `/contact` page for visitors without an account. Admins can view any
delegate's MUN experience and read contact queries from the Admin Dashboard.

---

## 6. Tech & design notes

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS 3.**
- **Diplomatic palette** (in `tailwind.config.ts`): deep `navy`, clean `cream`/
  white, and `gold`/`silver` accents. Reusable classes (`.btn-primary`,
  `.card`, `.input-field`, …) live in `app/globals.css`.
- **Auth** is a React context backed by `lib/auth.ts`. The permanent Owner
  (`Admin1`) is **seeded** into localStorage on first run — the prototype's
  stand-in for a seed migration. All other accounts are created by an admin;
  there is no public sign-up. Promotion/demotion of admins is Owner-only.

### ⚠️ Security — this is a prototype

The mocked auth stores passwords in **plaintext in localStorage** and enforces
roles **only on the client**. That's fine for Phase 1 prototyping but **must not
ship to production**. The Phase 2 path:

1. Replace `lib/auth.ts` with real API calls.
2. Hash passwords server-side; store users in a database.
3. Use httpOnly session cookies and verify roles on the **server**.
4. Move `Protected` checks into server components / middleware.

### Contact form delivery

The recipient address lives only in `lib/contact.ts` (`CONTACT_RECIPIENT`) and is
never rendered on the page. With no backend, submitting a query saves a local
copy (visible in the dashboard **Inbox**) and opens the visitor's mail app
pre-addressed to that recipient. To deliver server-side without relying on the
visitor's mail app, sign up for a free form backend (e.g. **Formspree** or
**Web3Forms**) and, in `components/ContactForm.tsx`, replace the `buildMailto`
call with a `fetch(POST)` to your form endpoint — the email stays configured on
their server, keyed by an access ID, so it never appears in the code.

---

## 7. A note on iCloud

This project lives in an iCloud Drive folder. iCloud may try to sync
`node_modules` and `.next` (thousands of files), which can slow installs and
builds. Both are already in `.gitignore`. If you hit sync hiccups, consider
moving the project to a non-iCloud location such as `~/Projects/mun-app`.

---

## 8. Ideas for Phase 2

- Real backend + database for auth and content.
- Working video/resource uploads (object storage).
- A live Model Diplomat powered by the Claude API.
- Per-committee sessions, delegate rosters, and resolution editing.
```
# ModelUN
