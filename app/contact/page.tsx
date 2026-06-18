import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";

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
