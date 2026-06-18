import Protected from "@/components/Protected";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  // role="admin" -> non-admins are redirected away before the dashboard renders.
  return (
    <Protected role="admin">
      <AdminDashboard />
    </Protected>
  );
}
