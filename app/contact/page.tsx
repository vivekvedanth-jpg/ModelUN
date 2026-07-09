import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";
import { CONTACT_EMAILS } from "@/lib/contact";
import { MailIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Questions about Let's MUN or how to get a delegate account for your Model United Nations club? Send us a message.",
  alternates: { canonical: "/contact" },
};

// Public page — no <Protected> wrapper, so visitors without an account can reach it.
export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Get in touch"
        title="Contact us"
        description="Questions about the platform or how to get a delegate account? Send a message and we'll reply by email."
      />

      <section className="container-page max-w-2xl space-y-8 py-12 sm:py-16">
        <div className="card flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          {CONTACT_EMAILS.map((email) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2 font-semibold text-navy-800 hover:text-gold-600"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                <MailIcon width={18} height={18} />
              </span>
              {email}
            </a>
          ))}
        </div>

        <ContactForm />
      </section>
    </>
  );
}
