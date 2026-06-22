import Link from "next/link";
import type { ReactNode } from "react";
import { GlobeIcon, CheckIcon } from "./icons";

const PERKS = [
  "Curated video lessons from rules of procedure to crisis committees",
  "A growing library of position-paper guides and research resources",
  "A built-in caucus timer and AI-assisted speech practice",
];

/** Shared split-screen wrapper for the Sign In / Sign Up pages. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-radial p-12 text-white lg:flex">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-500/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-navy-500/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-gold-400">
            <GlobeIcon />
          </span>
          <span className="font-serif text-lg font-bold">
            Let&apos;s <span className="text-gold-400">MUN</span>
          </span>
        </Link>

        <div className="relative">
          <h2 className="font-serif text-4xl font-bold leading-tight">
            Step onto the
            <br />
            world stage.
          </h2>
          <p className="mt-4 max-w-sm text-navy-200">
            Join a community of student diplomats learning to research, debate,
            and resolve the issues that shape our world.
          </p>

          <ul className="mt-8 space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-navy-100">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold-500 text-navy-900">
                  <CheckIcon width={13} height={13} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <blockquote className="relative border-l-2 border-gold-500 pl-4 text-sm italic text-navy-200">
          “The United Nations was not created to take humanity to heaven, but to
          save it from hell.”
          <footer className="mt-1 not-italic text-navy-300">— Dag Hammarskjöld</footer>
        </blockquote>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-cream px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
