"use client";

import { useState } from "react";
import { GlobeIcon } from "./icons";

/**
 * The Let's MUN emblem. Shows /logo.png (drop the official logo there) and
 * falls back to the globe badge if that file is missing, so the header/footer
 * never render a broken image before the asset is added.
 */
export default function LogoMark({ size = 36 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="flex items-center justify-center rounded-xl bg-navy-800 text-gold-400"
        style={{ width: size, height: size }}
      >
        <GlobeIcon width={size * 0.6} height={size * 0.6} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Let's MUN logo"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="rounded-full object-contain"
      style={{ width: size, height: size }}
    />
  );
}
