import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";

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

      <section className="container-page max-w-2xl py-12 sm:py-16">
        <ContactForm />
      </section>
    </>
  );
}
