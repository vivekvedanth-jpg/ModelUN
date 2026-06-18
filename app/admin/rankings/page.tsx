import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import RankingBoard from "@/components/RankingBoard";

export default function RankingsPage() {
  return (
    <Protected role="admin">
      <PageHeader
        eyebrow="Administration"
        title="Delegate Rankings"
        description="Award points per placement, see every delegate's score, and arrange the leaderboard."
      />

      <section className="container-page py-12 sm:py-16">
        <RankingBoard />
      </section>
    </Protected>
  );
}
