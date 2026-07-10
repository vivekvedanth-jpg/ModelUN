/** Client wrapper for the analytics endpoint (owner + granted admins only). */

export interface AnalyticsTotals {
  accounts: number;
  students: number;
  chairs: number;
  admins: number;
  guests: number;
  groups: number;
  videos: number;
  resources: number;
  conferencesLogged: number;
  uniqueConferences: number;
  awardsWon: number;
  activeDelegates: number;
  acceptedTerms: number;
}

export interface AnalyticsEngagement {
  activeStudentRate: number;
  avgConferencesPerActive: number;
  awardRate: number;
}

export interface GroupStat {
  id: string;
  name: string;
  students: number;
  chairs: number;
  admins: number;
}

export interface Analytics {
  generatedAt: number;
  totals: AnalyticsTotals;
  engagement: AnalyticsEngagement;
  signupsByMonth: { month: string; count: number }[];
  groups: GroupStat[];
}

export async function getAnalytics(): Promise<Analytics> {
  const res = await fetch("/api/analytics", { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Couldn't load analytics.");
  }
  return (await res.json()) as Analytics;
}
