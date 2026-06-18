import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import ExperienceManager from "@/components/ExperienceManager";

export default function ExperiencePage() {
  return (
    <Protected>
      <PageHeader
        eyebrow="Your record"
        title="My MUN Experience"
        description="Log every conference you've attended — your committee, portfolio, award, and scorecard — to build your delegate résumé."
      />

      <section className="container-page py-12 sm:py-16">
        <ExperienceManager />
      </section>
    </Protected>
  );
}
