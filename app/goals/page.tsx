import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  GlobeIcon,
  UsersIcon,
  ScaleIcon,
  AwardIcon,
  SparkleIcon,
  ShieldIcon,
  LockIcon,
  ArrowRightIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Our Goals & Mission",
  description:
    "Why Let's MUN exists: helping more young people learn Model United Nations, win awards, and go on to careers in foreign service and the United Nations — and how we handle student data responsibly.",
  alternates: { canonical: "/goals" },
};

const AIMS = [
  {
    icon: UsersIcon,
    title: "Reach younger delegates, earlier",
    body: "Great diplomats aren't born at university — they start in a classroom. We want to put clear, structured MUN training in front of students far earlier than the traditional path allows, so they build confidence years before their first conference.",
  },
  {
    icon: AwardIcon,
    title: "Help delegates place and win",
    body: "Learning the theory isn't enough. Our lessons, resources, caucus tools and practice partner are built to help delegates actually perform in committee — to speak, negotiate and place at the conferences they attend.",
  },
  {
    icon: ScaleIcon,
    title: "A pipeline into foreign service",
    body: "MUN is where a lifelong interest in diplomacy often begins. Our longer-term goal is to help more of these students move on into foreign service, international relations, and public policy careers.",
  },
  {
    icon: GlobeIcon,
    title: "And, one day, the UN itself",
    body: "The ambition doesn't stop at the classroom. If even a handful of the students who learn here go on to represent their countries — or serve in the United Nations itself — this platform will have done its job.",
  },
];

export default function GoalsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Who we are"
        title="Our Goals & Mission"
        description="Let's MUN exists to make world-class Model United Nations training available to any student — and to open doors that used to be reserved for a lucky few."
      />

      <section className="container-page max-w-3xl space-y-14 py-14 sm:py-20">
        {/* Mission intro */}
        <div className="space-y-4 text-lg leading-relaxed text-navy-700">
          <p>
            Model United Nations teaches the skills that shape leaders — public
            speaking, negotiation, research, and the empathy to see the world
            through another nation&apos;s eyes. Yet high-quality MUN coaching has
            always been uneven: concentrated in a few well-resourced schools and
            out of reach for most students who would thrive at it.
          </p>
          <p>
            We&apos;re building Let&apos;s MUN to change that. Our mission is to
            give every motivated student — wherever they are — a structured,
            practical path from their very first speech to their first
            resolution, and beyond.
          </p>
        </div>

        {/* What we're working toward */}
        <div>
          <h2 className="text-2xl font-bold text-navy-900">
            What we&apos;re working toward
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {AIMS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
                  <Icon width={22} height={22} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-600">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expansion */}
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-600">
              <SparkleIcon width={20} height={20} />
            </span>
            <h2 className="text-2xl font-bold text-navy-900">
              Growing to reach far more students
            </h2>
          </div>
          <div className="mt-5 space-y-4 leading-relaxed text-navy-700">
            <p>
              Today Let&apos;s MUN serves individual clubs and schools. But the
              goal has always been bigger: we want this platform in the hands of
              thousands of students, across many schools, cities and countries —
              anyone curious enough to step into a delegate&apos;s shoes.
            </p>
            <p>
              As we grow, we&apos;ll keep expanding what the platform can do —
              deeper lesson libraries, more practice tools, support for full
              conferences, and features that help clubs and educators run their
              own programs with less effort. Every improvement is aimed at the
              same outcome: more young people learning diplomacy, and doing it
              well.
            </p>
          </div>
        </div>

        {/* Data & privacy */}
        <div className="rounded-2xl border border-navy-100 bg-navy-50/50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
              <ShieldIcon width={20} height={20} />
            </span>
            <h2 className="text-2xl font-bold text-navy-900">
              How we handle student data
            </h2>
          </div>
          <div className="mt-5 space-y-4 leading-relaxed text-navy-700">
            <p>
              We take the trust students and clubs place in us seriously. Any
              information we collect — accounts, MUN experience, and activity on
              the platform — is used <strong>only by Let&apos;s MUN</strong>, and
              only to run and improve the service.
            </p>
            <ul className="space-y-3">
              {[
                "We use student data solely for our own purposes — to operate the platform and make it better. We do not sell it.",
                "We study how the platform is used so we can improve our lessons, tools and resources and help more delegates succeed.",
                "Access to accounts is managed by each club's administrators — there is no public sign-up.",
                "We keep only what we need to provide the service to you.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm">
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-gold-400">
                    <LockIcon width={11} height={11} />
                  </span>
                  <span className="text-navy-700">{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-navy-500">
              Have a question about your data or how it&apos;s used? Reach us any
              time at{" "}
              <a
                href="mailto:info@letsmun.com"
                className="font-semibold text-navy-800 underline-offset-2 hover:underline"
              >
                info@letsmun.com
              </a>
              .
            </p>
          </div>
        </div>

        {/* Closing CTA */}
        <div className="rounded-2xl bg-navy-radial px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-bold">Want to be part of it?</h2>
          <p className="mx-auto mt-3 max-w-xl text-navy-200">
            Whether you&apos;re a student, a club, or a school that wants to bring
            Let&apos;s MUN to your delegates, we&apos;d love to hear from you.
          </p>
          <Link
            href="/contact"
            className="btn-gold mt-6 inline-flex"
          >
            Get in touch <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
