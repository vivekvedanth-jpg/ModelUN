import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import GroupManager from "@/components/GroupManager";

export default function GroupsPage() {
  return (
    <Protected role="owner">
      <PageHeader
        eyebrow="Administration"
        title="Groups"
        description="Create clubs, schools or universities, then assign admins and see each group's students and admins."
      />

      <section className="container-page py-12 sm:py-16">
        <GroupManager />
      </section>
    </Protected>
  );
}
