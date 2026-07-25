"use client";

import { motion, useReducedMotion, useSpring } from "framer-motion";
import Link from "next/link";
import { type PointerEvent, type ReactNode } from "react";

const SPRING = { stiffness: 300, damping: 18, mass: 0.4 };
const PULL = 0.35;

/** A CTA link that leans toward the pointer on hover. No-op under reduced motion. */
export function MagneticButton({
  href,
  className,
  children,
}: Readonly<{ href: string; className: string; children: ReactNode }>) {
  const reduceMotion = useReducedMotion();
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);

  function handlePointerMove(event: PointerEvent<HTMLAnchorElement>) {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * PULL);
    y.set((event.clientY - rect.top - rect.height / 2) * PULL);
  }

  function handlePointerLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div style={{ x, y }} className="magnetic-button">
      <Link
        href={href}
        className={className}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {children}
      </Link>
    </motion.div>
  );
}
