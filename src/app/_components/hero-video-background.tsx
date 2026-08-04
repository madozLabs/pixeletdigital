"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";

/**
 * Autoplaying loop background for a hero, with a hard requirement: under
 * prefers-reduced-motion the video never mounts at all -- it's replaced by
 * the poster frame (or nothing, if no poster was set) rather than merely
 * paused, since a video element can still be interacted with by assistive
 * tech even when visually frozen.
 */
export function HeroVideoBackground({
  src,
  poster,
  alt,
  className,
}: Readonly<{
  src: string;
  poster?: string;
  alt: string;
  className?: string;
}>) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return poster ? (
      <Image
        className={className}
        src={poster}
        alt={alt}
        fill
        priority
        sizes="(max-width: 760px) 100vw, 44vw"
      />
    ) : null;
  }

  return (
    <video
      className={className}
      src={src}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
    />
  );
}
