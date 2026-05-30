"use client";

import { useEffect, useState } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

/**
 * Defer mounting the EffectComposer for one frame so the WebGLRenderer's
 * context is fully attached before postprocessing reads its attributes.
 * Avoids "Cannot read properties of null (reading 'alpha')" on first paint.
 */
export function Effects() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={0.95}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
    </EffectComposer>
  );
}
