"use client";

import { motion, useReducedMotion, useSpring } from "framer-motion";
import { type PointerEvent, type ReactNode } from "react";

const SPRING = { stiffness: 120, damping: 20, mass: 0.6 };

/**
 * Wraps a hero visual and drifts its children opposite the pointer, layer
 * by layer, for a subtle cursor-driven parallax. No-op under reduced motion.
 */
export function HeroParallax({
  children,
  className,
  strength = 18,
}: Readonly<{
  children: ReactNode;
  className?: string;
  strength?: number;
}>) {
  const reduceMotion = useReducedMotion();
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = (event.clientX - rect.left) / rect.width - 0.5;
    const relY = (event.clientY - rect.top) / rect.height - 0.5;
    x.set(relX * strength);
    y.set(relY * strength);
  }

  function handlePointerLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div
      className={className}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <motion.div style={{ x, y }} className="hero-parallax__layer">
        {children}
      </motion.div>
    </div>
  );
}
