import Link from "next/link";
import HomeCTA from "@/components/HomeCTA";
import {
  ArrowRightIcon,
  MicIcon,
  ScaleIcon,
  DocumentIcon,
  GlobeIcon,
  PlayIcon,
  ClockIcon,
  SparkleIcon,
  BookIcon,
} from "@/components/icons";

const STATS = [
  { value: "193", label: "UN member states to represent" },
  { value: "5", label: "core diplomatic skills you'll build" },
  { value: "100%", label: "free to learn, at your own pace" },
];

const SKILLS = [
  {
    icon: MicIcon,
    title: "Public Speaking",
    body: "Command the floor with confident speeches, moderated caucuses, and persuasive points of debate.",
  },
  {
    icon: ScaleIcon,
    title: "Diplomacy & Negotiation",
    body: "Build alliances, broker compromises, and turn opposing nations into co-sponsors of your resolution.",
  },
  {
    icon: DocumentIcon,
    title: "Research & Policy",
    body: "Write position papers and draft resolutions grounded in real-world facts and UN procedure.",
  },
  {
    icon: GlobeIcon,
    title: "Global Awareness",
    body: "Step into another nation's shoes and understand the issues shaping our interconnected world.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Receive your delegate account",
    body: "Your club administrator creates an account for you — there's no public sign-up.",
  },
  {
    n: "02",
    title: "Learn the fundamentals",
    body: "Watch lesson videos and study resources on rules of procedure, caucusing, and resolution writing.",
  },
  {
    n: "03",
    title: "Practice your craft",
    body: "Time your speeches with the caucus timer and rehearse with the MUN Assistant.",
  },
  {
    n: "04",
    title: "Take your seat",
    body: "Walk into your first committee session prepared, confident, and ready to debate.",
  },
];

const TOOLS = [
  { icon: PlayIcon, title: "Videos", body: "Guided lessons from beginner to crisis committee.", href: "/videos" },
  { icon: BookIcon, title: "Resources", body: "Guides, templates, and position-paper examples.", href: "/resources" },
  { icon: ClockIcon, title: "Caucus Timer", body: "Keep speeches and caucuses precisely on time.", href: "/timer" },
  { icon: SparkleIcon, title: "MUN Assistant", body: "Your AI-powered diplomacy practice partner.", href: "/model-diplomat" },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://letsmun.com/#organization",
      name: "Let's MUN",
      url: "https://letsmun.com",
      logo: "https://letsmun.com/logo.png",
      description:
        "A learning platform for student diplomats practicing Model United Nations.",
      email: "info@letsmun.com",
    },
    {
      "@type": "WebSite",
      "@id": "https://letsmun.com/#website",
      name: "Let's MUN",
      url: "https://letsmun.com",
      publisher: { "@id": "https://letsmun.com/#organization" },
      description:
        "Learn the art of diplomacy: public speaking, negotiation, research and resolution writing for Model United Nations.",
      // Enables Google's sitelinks search box, wired to our /search page.
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://letsmun.com/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-navy-radial text-white">
        <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-navy-500/20 blur-3xl" />

        <div className="container-page relative py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow justify-center !text-gold-400">
              <span className="h-px w-8 bg-gold-400" />
              Model United Nations · Learning Platform
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-6xl">
              Learn the art of{" "}
              <span className="text-gold-400">diplomacy.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-navy-100">
              Model UN puts you in the seat of a delegate, debating the world&apos;s
              most pressing issues. This platform teaches you everything you need
              — from your first speech to your first resolution.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <HomeCTA signedOutLabel="Sign In to Start Learning" />
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-20 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm"
              >
                <div className="font-serif text-4xl font-bold text-gold-400">
                  {s.value}
                </div>
                <div className="mt-2 text-sm text-navy-200">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- What is MUN ---------- */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">What is Model UN?</p>
            <h2 className="mt-4 text-3xl font-bold text-navy-900 sm:text-4xl">
              The United Nations, simulated by students.
            </h2>
            <div className="mt-6 space-y-4 text-navy-700">
              <p>
                Model United Nations is an academic simulation in which students
                step into the role of diplomats representing a country in a
                committee of the United Nations. Delegates research their
                nation&apos;s policies, debate global issues, and work together to
                draft resolutions — just like real ambassadors do.
              </p>
              <p>
                It&apos;s practiced in thousands of schools and universities
                worldwide. Beyond the debate, MUN builds the skills that matter
                most: critical thinking, persuasive communication, and the
                empathy to see an issue from another nation&apos;s perspective.
              </p>
            </div>
            <HomeCTA signedOutLabel="Begin your training" variant="link" />
          </div>

          <div className="relative">
            <div className="card-hover">
              <div className="flex items-center gap-3 border-b border-navy-100 pb-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
                  <GlobeIcon />
                </span>
                <div>
                  <div className="font-serif font-bold text-navy-900">
                    General Assembly
                  </div>
                  <div className="text-xs text-navy-500">Committee in session</div>
                </div>
                <span className="badge ml-auto bg-green-100 text-green-700">
                  Live
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  "Delegate of France yields the floor.",
                  "Motion to open a moderated caucus.",
                  "Topic: Global Climate Resilience.",
                ].map((line, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-500" />
                    <span className="text-navy-700">{line}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">
                  Speaker&apos;s time
                </span>
                <span className="font-mono text-lg font-bold text-navy-900">
                  01:30
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Skills ---------- */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow justify-center">What you&apos;ll develop</p>
            <h2 className="mt-4 text-3xl font-bold text-navy-900 sm:text-4xl">
              Skills that last a lifetime
            </h2>
            <p className="mt-4 text-navy-600">
              Every great diplomat is made, not born. Here&apos;s what you&apos;ll
              build along the way.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SKILLS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card-hover">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
                  <Icon width={24} height={24} />
                </span>
                <h3 className="mt-5 text-lg font-bold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="bg-cream py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow justify-center">How it works</p>
            <h2 className="mt-4 text-3xl font-bold text-navy-900 sm:text-4xl">
              From newcomer to delegate in four steps
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="card relative">
                <span className="font-serif text-5xl font-bold text-gold-300">
                  {step.n}
                </span>
                <h3 className="mt-3 text-lg font-bold text-navy-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-600">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Platform tools ---------- */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow justify-center">Inside the platform</p>
            <h2 className="mt-4 text-3xl font-bold text-navy-900 sm:text-4xl">
              Everything you need in one place
            </h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map(({ icon: Icon, title, body, href }) => (
              <Link key={title} href={href} className="card-hover group">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15 text-gold-600">
                  <Icon width={24} height={24} />
                </span>
                <h3 className="mt-5 flex items-center gap-1.5 text-lg font-bold text-navy-900">
                  {title}
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-600">{body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="bg-navy-radial">
        <div className="container-page py-20 text-center sm:py-24">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">
            Ready to take your seat at the table?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-200">
            Pick up where you left off and keep building the skills of
            world-class diplomacy.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <HomeCTA signedOutLabel="Sign In" />
          </div>
        </div>
      </section>
    </>
  );
}
