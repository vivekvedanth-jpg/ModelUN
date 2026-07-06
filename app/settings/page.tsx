import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import SettingsPanel from "@/components/SettingsPanel";

export default function SettingsPage() {
  return (
    <Protected allowGuest>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Update your email and password, and manage your account."
      />

      <section className="container-page max-w-3xl py-12 sm:py-16">
        <SettingsPanel />
      </section>
    </Protected>
  );
}
