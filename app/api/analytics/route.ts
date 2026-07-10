import { type NextRequest, NextResponse } from "next/server";
import {
  usersCol,
  groupsCol,
  experiencesCol,
  videosCol,
  resourcesCol,
  AWARD_PLACEMENTS,
  type UserDoc,
} from "@/lib/server/db";
import { getSessionUser, isOwnerDoc, fail } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner, or an admin the Owner has granted analytics access. */
function mayViewAnalytics(u: UserDoc | null): boolean {
  return !!u && (isOwnerDoc(u) || (u.role === "admin" && !!u.canViewAnalytics));
}

/** YYYY-MM key for a timestamp, in the server's locale-independent form. */
function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The last `n` month keys, oldest first, ending with the current month. */
function recentMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const me = await getSessionUser(req);
  if (!me) return fail("You must be signed in.", 401);
  if (!mayViewAnalytics(me)) return fail("You don't have access to analytics.", 403);

  const [users, groups, experiences, videos, resources] = await Promise.all([
    (await usersCol()).find({}).toArray(),
    (await groupsCol()).find({}).toArray(),
    (await experiencesCol()).find({}).toArray(),
    (await videosCol()).countDocuments(),
    (await resourcesCol()).countDocuments(),
  ]);

  // Accounts by role.
  const byRole = { owner: 0, admin: 0, chair: 0, normal: 0, guest: 0 };
  let acceptedTerms = 0;
  for (const u of users) {
    byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    if (u.acceptedTermsAt) acceptedTerms++;
  }
  const students = byRole.normal;

  // Signups over the last 6 months.
  const months = recentMonths(6);
  const signupsByMonth = Object.fromEntries(months.map((m) => [m, 0]));
  for (const u of users) {
    const k = monthKey(u.createdAt);
    if (k in signupsByMonth) signupsByMonth[k]++;
  }

  // MUN experience + awards.
  const awardSet = new Set<string>(AWARD_PLACEMENTS);
  let awardsWon = 0;
  const conferences = new Set<string>();
  const activeDelegates = new Set<string>();
  for (const e of experiences) {
    if (awardSet.has(e.placement)) awardsWon++;
    if (e.conference?.trim()) conferences.add(e.conference.trim().toLowerCase());
    if (e.owner) activeDelegates.add(e.owner.toLowerCase());
  }

  // Per-group breakdown (students, chairs, admins).
  const groupStats = groups
    .map((g) => {
      const members = users.filter((u) => u.groupId === g.id);
      return {
        id: g.id,
        name: g.name,
        students: members.filter((u) => u.role === "normal").length,
        chairs: members.filter((u) => u.role === "chair").length,
        admins: members.filter((u) => u.role === "admin").length,
      };
    })
    .sort((a, b) => b.students - a.students);

  return NextResponse.json({
    generatedAt: Date.now(),
    totals: {
      accounts: users.length,
      students,
      chairs: byRole.chair,
      admins: byRole.admin,
      guests: byRole.guest,
      groups: groups.length,
      videos,
      resources,
      conferencesLogged: experiences.length,
      uniqueConferences: conferences.size,
      awardsWon,
      activeDelegates: activeDelegates.size,
      acceptedTerms,
    },
    engagement: {
      // How many students have actually logged MUN experience — a proxy for
      // active use we can compute without behavioural tracking.
      activeStudentRate: students ? Math.round((activeDelegates.size / students) * 100) : 0,
      avgConferencesPerActive: activeDelegates.size
        ? Math.round((experiences.length / activeDelegates.size) * 10) / 10
        : 0,
      awardRate: experiences.length
        ? Math.round((awardsWon / experiences.length) * 100)
        : 0,
    },
    signupsByMonth: months.map((m) => ({ month: m, count: signupsByMonth[m] })),
    groups: groupStats,
  });
}
