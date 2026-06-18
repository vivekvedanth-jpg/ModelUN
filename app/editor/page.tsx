import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import ResolutionEditor from "@/components/ResolutionEditor";

export default function EditorPage() {
  return (
    <Protected>
      <PageHeader
        eyebrow="Write"
        title="Resolution Editor"
        description="A distraction-free space to draft your resolutions. Everything saves automatically, spell-check is built in, and you can export to PDF anytime."
      />

      <section className="container-page py-12 sm:py-16">
        <ResolutionEditor />
      </section>
    </Protected>
  );
}
