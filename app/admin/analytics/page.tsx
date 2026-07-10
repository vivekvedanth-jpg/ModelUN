import Protected from "@/components/Protected";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function AnalyticsPage() {
  // Any admin passes <Protected>; the dashboard itself enforces the finer
  // "Owner or granted admin" rule (and the API does too).
  return (
    <Protected role="admin">
      <AnalyticsDashboard />
    </Protected>
  );
}
