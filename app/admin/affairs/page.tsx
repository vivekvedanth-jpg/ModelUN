import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import AccountManager from "@/components/AccountManager";
import ProfileBot from "@/components/ProfileBot";

export default function DelegateAffairsPage() {
  return (
    <Protected role="admin">
      <PageHeader
        eyebrow="Administration"
        title="Delegate Affairs"
        description="Create accounts, manage roles, review each delegate's MUN experience, and look up any profile."
      />

      <section className="container-page space-y-14 py-12 sm:py-16">
        {/* Quick lookup chatbot */}
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Delegate lookup</h2>
          <p className="mt-1 text-navy-600">
            Ask about any delegate by email or first name to see their profile,
            conferences, and score.
          </p>
          <div className="mt-6 max-w-2xl">
            <ProfileBot />
          </div>
        </div>

        {/* Create / manage accounts + view experience */}
        <AccountManager />
      </section>
    </Protected>
  );
}
