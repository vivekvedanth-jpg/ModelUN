import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  /** Optional slot rendered on the right (e.g. a stat or action). */
  aside?: ReactNode;
}

/** Consistent navy hero header used across the signed-in feature pages. */
export default function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: PageHeaderProps) {
  return (
    <div className="bg-navy-radial text-white">
      <div className="container-page flex flex-col items-start justify-between gap-6 py-14 sm:py-16 md:flex-row md:items-end">
        <div>
          <p className="eyebrow !text-gold-400">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h1>
          {description && (
            <p className="mt-3 max-w-2xl text-navy-200">{description}</p>
          )}
        </div>
        {aside}
      </div>
    </div>
  );
}
