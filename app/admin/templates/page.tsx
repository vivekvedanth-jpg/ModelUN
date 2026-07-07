import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import TemplateManager from "@/components/TemplateManager";

export default function TemplatesPage() {
  return (
    <Protected role="admin">
      <PageHeader
        eyebrow="Admin"
        title="Document Templates"
        description="Edit the official UN formats delegates start from, or create your own custom templates."
      />

      <section className="container-page py-12 sm:py-16">
        <TemplateManager />
      </section>
    </Protected>
  );
}
