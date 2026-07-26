"use client";

import { motion, useReducedMotion } from "framer-motion";

export function KineticHeading({
  text,
  className,
  accentLastLine = false,
}: Readonly<{
  text: string | readonly string[];
  className?: string;
  accentLastLine?: boolean;
}>) {
  const reduceMotion = useReducedMotion();
  const lines = typeof text === "string" ? [text] : text;

  if (reduceMotion) {
    return (
      <h1 className={className}>
        {lines.map((line, index) => (
          <span
            key={`${line}-${index}`}
            className={
              accentLastLine && index === lines.length - 1
                ? "kinetic-heading__line--accent"
                : undefined
            }
          >
            {line}
          </span>
        ))}
      </h1>
    );
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
      {lines.map((line, lineIndex) => (
        <span
          key={`${line}-${lineIndex}`}
          className={
            accentLastLine && lineIndex === lines.length - 1
              ? "kinetic-heading__line--accent"
              : undefined
          }
        >
          {line.split(" ").map((word, wordIndex) => (
            <span
              key={`${word}-${wordIndex}`}
              className="kinetic-heading__word"
            >
              <motion.span
                className="kinetic-heading__word-inner"
                variants={{
                  hidden: { y: "110%" },
                  visible: {
                    y: "0%",
                    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              >
                {word}
                {wordIndex < line.split(" ").length - 1 ? "\u00a0" : ""}
              </motion.span>
            </span>
          ))}
        </span>
      ))}
    </motion.h1>
  );
}
