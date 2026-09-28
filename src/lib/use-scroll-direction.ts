"use client";

import { useEffect, useState } from "react";

/** True while the page is scrolling down (floating buttons slide away so they never cover content). */
export function useHiddenWhileScrollingDown() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
      if (Math.abs(y - last) < 8) return; // ignore jitter
      // Hidden while moving down; back when moving up, near the top, or at the very end of the list.
      setHidden(y > last && y > 80 && !nearBottom);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}
