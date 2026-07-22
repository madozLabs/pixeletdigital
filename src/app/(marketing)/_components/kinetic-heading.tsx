"use client";

import { motion, useReducedMotion } from "framer-motion";

export function KineticHeading({
  text,
  className,
}: Readonly<{ text: string; className?: string }>) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  if (reduceMotion) {
    return <h1 className={className}>{text}</h1>;
  }

  return (
    <motion.h1
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.045, delayChildren: 0.1 } },
      }}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          style={{ display: "inline-block", overflow: "hidden" }}
        >
          <motion.span
            style={{ display: "inline-block" }}
            variants={{
              hidden: { y: "110%" },
              visible: {
                y: "0%",
                transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.h1>
  );
}
