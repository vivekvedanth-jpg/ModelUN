import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import VideoLibrary from "@/components/VideoLibrary";

export default function VideosPage() {
  return (
    <Protected>
      <PageHeader
        eyebrow="Learn"
        title="Lesson Videos"
        description="Guided lessons that take you from your very first committee session to advanced crisis strategy."
      />

      <section className="container-page py-12 sm:py-16">
        <VideoLibrary />
      </section>
    </Protected>
  );
}
