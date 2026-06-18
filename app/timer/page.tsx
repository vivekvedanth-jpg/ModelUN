import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import CaucusTimer from "@/components/CaucusTimer";

export default function TimerPage() {
  return (
    <Protected>
      <PageHeader
        eyebrow="Tools"
        title="Caucus Timer"
        description="Keep speeches and caucuses precisely on time. Pick a preset or set your own duration."
      />

      <section className="container-page py-12 sm:py-16">
        <CaucusTimer />

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-navy-100 bg-white p-6 text-sm text-navy-600">
          <p className="font-semibold text-navy-800">Tip for chairs &amp; delegates</p>
          <p className="mt-1.5">
            A moderated caucus is typically set with a fixed total time and a
            shorter speaking time per delegate. Use a preset for the speaking
            time, and watch the bar turn red in the final ten seconds.
          </p>
        </div>
      </section>
    </Protected>
  );
}
