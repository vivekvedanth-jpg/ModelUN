import Link from "next/link";
import { MailIcon } from "./icons";
import { CONTACT_EMAILS } from "@/lib/contact";
import LogoMark from "./LogoMark";

export default function Footer() {
  return (
    <footer className="mt-auto bg-navy-900 text-navy-100">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <LogoMark size={36} />
            <span className="font-serif text-lg font-bold text-white">
              Let&apos;s <span className="text-gold-400">MUN</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-200">
            Empowering the next generation of student diplomats through debate,
            research, and global collaboration.
          </p>
          <ul className="mt-4 space-y-2">
            {CONTACT_EMAILS.map((email) => (
              <li key={email}>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 text-sm text-navy-200 hover:text-white"
                >
                  <MailIcon width={14} height={14} /> {email}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-gold-400">
            Learn
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/videos" className="hover:text-white">Videos</Link></li>
            <li><Link href="/resources" className="hover:text-white">Resources</Link></li>
            <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
            <li><Link href="/timer" className="hover:text-white">Caucus Timer</Link></li>
            <li><Link href="/model-diplomat" className="hover:text-white">MUN Assistant</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-gold-400">
            Account
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/signin" className="hover:text-white">Sign In</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact us</Link></li>
            <li><span className="text-navy-300">Accounts are admin-issued</span></li>
          </ul>
        </div>

        <div>
          <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-gold-400">
            About
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link href="/goals" className="hover:text-white">
                Our Goals &amp; Mission
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white">
                Contact us
              </Link>
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-navy-200">
            A simulation of the United Nations where students step into the role
            of delegates to debate the world&apos;s most pressing issues.
          </p>
        </div>
      </div>

      <div className="border-t border-navy-800">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-navy-300 sm:flex-row">
          <span>© {new Date().getFullYear()} Let&apos;s MUN. Built for student diplomats.</span>
          <span>Phase 1 · Core Layout &amp; Authentication</span>
        </div>
      </div>
    </footer>
  );
}
