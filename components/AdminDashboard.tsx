"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getVisibleAccounts, isOwner, type AccountDetail } from "@/lib/auth";
import { getResources, getVideos } from "@/lib/content";
import PageHeader from "./PageHeader";
import UploadCard from "./UploadCard";
import ContactInbox from "./ContactInbox";
import {
  UsersIcon,
  PlayIcon,
  BookIcon,
  ShieldIcon,
  ScaleIcon,
  AwardIcon,
  ArrowRightIcon,
} from "./icons";

export default function AdminDashboard() {
  const { user } = useAuth();
  const owner = isOwner(user);

  const [users, setUsers] = useState<AccountDetail[]>([]);
  const [videoCount, setVideoCount] = useState(0);
  const [resourceCount, setResourceCount] = useState(0);

  // Read accounts + content counts from localStorage on the client.
  useEffect(() => {
    setUsers(getVisibleAccounts(user));
    setVideoCount(getVideos().length);
    setResourceCount(getResources().length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const stats = [
    {
      icon: UsersIcon,
      label: owner ? "Total accounts" : "Accounts you manage",
      value: users.length,
    },
    { icon: PlayIcon, label: "Lesson videos", value: videoCount },
    { icon: BookIcon, label: "Resources", value: resourceCount },
    {
      icon: ShieldIcon,
      label: "Your role",
      value: owner ? "Owner" : "Admin",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Admin Dashboard"
        description={`Signed in as ${user?.email ?? "Admin"}. ${
          owner
            ? "As the Owner you manage every account and all content."
            : "Manage content and delegate accounts."
        }`}
      />

      <section className="container-page space-y-14 py-12 sm:py-16">
        {/* Stats */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
                <Icon width={22} height={22} />
              </span>
              <div className="mt-4 font-serif text-3xl font-bold text-navy-900">
                {value}
              </div>
              <div className="mt-1 text-sm text-navy-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Content management / upload controls */}
        <div id="upload" className="scroll-mt-24">
          <h2 className="text-2xl font-bold text-navy-900">Content management</h2>
          <p className="mt-1 text-navy-600">
            Publish new videos and resources, or remove existing ones from the{" "}
            <a href="/videos" className="font-semibold underline">
              Videos
            </a>{" "}
            and{" "}
            <a href="/resources" className="font-semibold underline">
              Resources
            </a>{" "}
            pages.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <UploadCard
              kind="video"
              title="Upload a new video"
              description="Add a lesson to the Videos library."
              accept="video/*"
              cta="Publish video"
            />
            <UploadCard
              kind="resource"
              title="Upload a new resource"
              description="Add a guide or template to Resources."
              accept=".pdf,.doc,.docx"
              cta="Publish resource"
            />
          </div>
        </div>

        {/* Admin areas */}
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Manage delegates</h2>
          <p className="mt-1 text-navy-600">
            {owner
              ? "Accounts, experience, rankings, and committee scoring live on their own pages."
              : "Accounts, experience, and rankings live on their own pages."}
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Link href="/admin/affairs" className="card-hover group">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-800">
                <UsersIcon width={24} height={24} />
              </span>
              <h3 className="mt-5 flex items-center gap-1.5 text-lg font-bold text-navy-900">
                Delegate Affairs
                <ArrowRightIcon
                  width={16}
                  height={16}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">
                Create accounts, {owner ? "promote/demote, " : ""}review each
                delegate&apos;s MUN experience, and look up profiles.
              </p>
            </Link>

            <Link href="/admin/rankings" className="card-hover group">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15 text-gold-600">
                <AwardIcon width={24} height={24} />
              </span>
              <h3 className="mt-5 flex items-center gap-1.5 text-lg font-bold text-navy-900">
                Delegate Rankings
                <ArrowRightIcon
                  width={16}
                  height={16}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">
                Score awards, view the leaderboard, and arrange the rankings.
              </p>
            </Link>

            {/* Groups — Owner organizes clubs/schools and scopes admins. */}
            {owner && (
              <Link href="/admin/groups" className="card-hover group">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
                  <UsersIcon width={24} height={24} />
                </span>
                <h3 className="mt-5 flex items-center gap-1.5 text-lg font-bold text-navy-900">
                  Groups
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-600">
                  Create clubs or schools, assign admins to a group, and see each
                  group&apos;s students and admins.
                </p>
              </Link>
            )}

            {/* Committee scoring — Owner oversight of all chairs' committees. */}
            {owner && (
              <Link href="/committee" className="card-hover group">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                  <ScaleIcon width={24} height={24} />
                </span>
                <h3 className="mt-5 flex items-center gap-1.5 text-lg font-bold text-navy-900">
                  Committee Scoring
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-600">
                  Oversee every chair&apos;s committee — score delegates on GSL,
                  caucuses and custom categories, with per-committee standings.
                </p>
              </Link>
            )}
          </div>
        </div>

        {/* Queries sent from the public contact page */}
        <ContactInbox />
      </section>
    </>
  );
}
