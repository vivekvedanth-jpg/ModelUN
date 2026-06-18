import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import CommitteeBoard from "@/components/CommitteeBoard";

export default function CommitteePage() {
  return (
    <Protected role="chair">
      <PageHeader
        eyebrow="Chair tools"
        title="Committee Scoring"
        description="Score the delegates in your committee across GSL, caucuses and any categories you add — with live, committee-only standings."
      />

      <section className="container-page py-12 sm:py-16">
        <CommitteeBoard />
      </section>
    </Protected>
  );
}
