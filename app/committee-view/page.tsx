import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import CommitteeView from "@/components/CommitteeView";

export default function CommitteeViewPage() {
  return (
    <Protected>
      <PageHeader
        eyebrow="Your committee"
        title="Committee"
        description="Follow your committee's speaker list, and see your scores once your chair releases them."
      />

      <section className="container-page py-12 sm:py-16">
        <CommitteeView />
      </section>
    </Protected>
  );
}
