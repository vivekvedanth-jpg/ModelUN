"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { isAdmin, displayName } from "@/lib/auth";
import { MenuIcon, CloseIcon, UploadIcon } from "./icons";
import LogoMark from "./LogoMark";

/** Links every signed-in (normal) user sees. */
const NORMAL_LINKS = [
  { href: "/", label: "Home" },
  { href: "/videos", label: "Videos" },
  { href: "/resources", label: "Resources" },
  { href: "/timer", label: "Timer" },
  { href: "/committee-view", label: "Committee" },
  { href: "/model-diplomat", label: "MUN Assistant" },
  { href: "/experience", label: "My MUNs" },
  { href: "/editor", label: "Editor" },
];

/**
 * Admins & the owner: like normal users, but the "Committee" link points at the
 * management board (scoring, votes, chat) instead of the read-only delegate view.
 */
const ADMIN_LINKS = [
  { href: "/", label: "Home" },
  { href: "/videos", label: "Videos" },
  { href: "/resources", label: "Resources" },
  { href: "/timer", label: "Timer" },
  { href: "/committee", label: "Committee" },
  { href: "/model-diplomat", label: "MUN Assistant" },
  { href: "/experience", label: "My MUNs" },
  { href: "/editor", label: "Editor" },
  { href: "/admin", label: "Admin" },
];

/** Focused link set for chairs (committee-scoring staff). */
const CHAIR_LINKS = [
  { href: "/", label: "Home" },
  { href: "/videos", label: "Videos" },
  { href: "/resources", label: "Resources" },
  { href: "/timer", label: "Timer" },
  { href: "/committee", label: "Committee" },
];

/** Temporary guest accounts only get the committee page (plus Settings). */
const GUEST_LINKS = [
  { href: "/", label: "Home" },
  { href: "/committee-view", label: "Committee" },
];

function Avatar({ name, admin }: { name: string; admin: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
        admin ? "bg-gold-500 text-navy-900" : "bg-navy-800 text-white"
      }`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function Navbar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Decide which links to show based on auth state + role.
  const links = !user
    ? [{ href: "/", label: "Home" }]
    : user.role === "guest"
    ? GUEST_LINKS
    : user.role === "chair"
    ? CHAIR_LINKS
    : isAdmin(user.role)
    ? ADMIN_LINKS
    : NORMAL_LINKS;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function handleSignOut() {
    signOut();
    setOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-navy-100 bg-cream/85 backdrop-blur-md">
      <nav className="container-page flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <LogoMark size={36} />
          <span className="font-serif text-lg font-bold text-navy-900">
            Let&apos;s <span className="text-gold-600">MUN</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? "bg-navy-800 text-white"
                  : "text-navy-700 hover:bg-navy-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth controls */}
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              {isAdmin(user.role) && (
                <Link href="/admin#upload" className="btn-gold !px-4 !py-2">
                  <UploadIcon /> Upload
                </Link>
              )}
              <Link
                href="/settings"
                title="Account settings"
                className="flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3 py-1.5 transition-colors hover:border-navy-300 hover:bg-navy-50"
              >
                <Avatar name={displayName(user)} admin={user.role !== "normal"} />
                <span className="text-sm font-semibold text-navy-800">
                  {displayName(user)}
                </span>
                {user.role !== "normal" && (
                  <span
                    className={`badge ${
                      user.role === "chair"
                        ? "bg-emerald-100 text-emerald-700"
                        : user.role === "guest"
                        ? "bg-navy-100 text-navy-600"
                        : "bg-gold-100 text-gold-700"
                    }`}
                  >
                    {user.role === "owner"
                      ? "Owner"
                      : user.role === "chair"
                      ? "Chair"
                      : user.role === "guest"
                      ? "Guest"
                      : "Admin"}
                  </span>
                )}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/signin" className="btn-primary !px-5 !py-2">
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-navy-800 hover:bg-navy-100 lg:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-navy-100 bg-cream lg:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
                  isActive(l.href)
                    ? "bg-navy-800 text-white"
                    : "text-navy-700 hover:bg-navy-100"
                }`}
              >
                {l.label}
              </Link>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-navy-100 pt-4">
              {user ? (
                <>
                  <div className="flex items-center gap-2 px-1">
                    <Avatar name={displayName(user)} admin={user.role !== "normal"} />
                    <span className="text-sm font-semibold text-navy-800">
                      {displayName(user)}
                    </span>
                    {isAdmin(user.role) && (
                      <span className="badge bg-gold-100 text-gold-700">
                        {user.role === "owner" ? "Owner" : "Admin"}
                      </span>
                    )}
                    {user.role === "guest" && (
                      <span className="badge bg-navy-100 text-navy-600">
                        Guest
                      </span>
                    )}
                  </div>
                  {isAdmin(user.role) && (
                    <Link
                      href="/admin#upload"
                      onClick={() => setOpen(false)}
                      className="btn-gold w-full"
                    >
                      <UploadIcon /> Upload Content
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setOpen(false)}
                    className="btn-ghost w-full"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="btn-ghost w-full"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/signin"
                  onClick={() => setOpen(false)}
                  className="btn-primary w-full"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
