"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TRANSITION_MS = 750;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function useSectionScroll(sectionCount: number) {
  const [index, setIndex] = useState(0);
  const [blend, setBlend] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const transitioning = useRef(false);
  const touchStartY = useRef(0);

  const goTo = useCallback(
    (target: number) => {
      if (transitioning.current) return;
      if (target < 0 || target >= sectionCount || target === index) return;

      transitioning.current = true;
      setDirection(target > index ? 1 : -1);
      const start = performance.now();

      const tick = (now: number) => {
        const raw = Math.min(1, (now - start) / TRANSITION_MS);
        setBlend(easeInOutCubic(raw));

        if (raw < 1) {
          requestAnimationFrame(tick);
          return;
        }

        setIndex(target);
        setBlend(0);
        transitioning.current = false;
      };

      requestAnimationFrame(tick);
    },
    [index, sectionCount],
  );

  const step = useCallback(
    (delta: 1 | -1) => {
      goTo(index + delta);
    },
    [goTo, index],
  );

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 8) return;
      step(e.deltaY > 0 ? 1 : -1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        step(1);
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        step(-1);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const delta = touchStartY.current - e.changedTouches[0].clientY;
      if (Math.abs(delta) < 40) return;
      step(delta > 0 ? 1 : -1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [step]);

  const opacityFor = useCallback(
    (sectionIndex: number) => {
      if (sectionIndex === index && blend === 0) return 1;
      if (direction === 1) {
        if (sectionIndex === index) return 1 - blend;
        if (sectionIndex === index + 1) return blend;
      } else {
        if (sectionIndex === index) return 1 - blend;
        if (sectionIndex === index - 1) return blend;
      }
      return 0;
    },
    [blend, direction, index],
  );

  return { index, blend, goTo, opacityFor, sectionCount };
}
