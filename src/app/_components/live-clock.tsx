"use client";

import { useEffect, useState } from "react";

/**
 * Real, not decorative: the actual current time in Ouagadougou. A small,
 * honest "the studio is live" signal that needs no fabricated stats or
 * client logos we don't have.
 */
export function LiveClock({
  timeZone,
  className,
}: Readonly<{ timeZone: string; className?: string }>) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat("fr-FR", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
    setTime(format());
    const id = setInterval(() => setTime(format()), 15_000);
    return () => clearInterval(id);
  }, [timeZone]);

  return (
    <span className={className} suppressHydrationWarning>
      {time ?? "--:--"}
    </span>
  );
}
