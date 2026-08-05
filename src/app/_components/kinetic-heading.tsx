"use client";

import { motion, useReducedMotion } from "framer-motion";

export function KineticHeading({
  text,
  className,
  accentLastLine = false,
  cmsField,
}: Readonly<{
  text: string | readonly string[];
  className?: string;
  accentLastLine?: boolean;
  cmsField?: string;
}>) {
  const reduceMotion = useReducedMotion();
  const lines = typeof text === "string" ? [text] : text;

  if (reduceMotion) {
    return (
      <h1 className={className} data-cms-field={cmsField}>
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
      data-cms-field={cmsField}
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
          {line.split(" ").map((word, wordIndex, words) => (
            // The trailing space lives OUTSIDE the overflow:hidden word box
            // (as its own text node) rather than as the last character
            // inside it -- a space at the very end of an inline-block's own
            // content collapses away in rendered layout (and in innerText),
            // gluing words together, even though it survives in the DOM.
            <span key={`${word}-${wordIndex}`}>
              <span className="kinetic-heading__word">
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
                </motion.span>
              </span>
              {wordIndex < words.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      ))}
    </motion.h1>
  );
}
