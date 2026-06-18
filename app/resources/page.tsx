import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import ResourceLibrary from "@/components/ResourceLibrary";
import QASection from "@/components/QASection";

export default function ResourcesPage() {
  return (
    <Protected>
      <PageHeader
        eyebrow="Learn"
        title="Resources"
        description="Templates, guides, and real UN resolutions to research, write, and debate like a seasoned delegate."
      />

      <section className="container-page py-12 sm:py-16">
        <ResourceLibrary />

        {/* Q&A — delegates can post public or private questions here. */}
        <QASection />
      </section>
    </Protected>
  );
}
