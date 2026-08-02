"use client";

import { useState } from "react";

export function CmsTabs({
  items,
}: Readonly<{
  items: readonly Readonly<{ title: string; text: string }>[];
}>) {
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, items.length - 1);
  if (items.length === 0) return null;
  return (
    <div className="cms-public-tabs">
      <div className="cms-public-tabs__list" role="tablist">
        {items.map((item, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className={index === activeIndex ? "is-active" : ""}
            onClick={() => setActive(index)}
          >
            {item.title || `Onglet ${index + 1}`}
          </button>
        ))}
      </div>
      <div className="cms-public-tabs__panel" role="tabpanel">
        {items[activeIndex]?.text}
      </div>
    </div>
  );
}
