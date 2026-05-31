"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const GRID_X = 180;
const GRID_Z = 70;
const SPACING = 0.11;
const COUNT = GRID_X * GRID_Z;

const vertexShader = `
  uniform float uTime;
  attribute vec3 aColor;
  attribute float aSize;
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    vec3 pos = position;
    float wave1 = sin(pos.x * 0.42 + uTime * 0.85) * cos(pos.z * 0.36 + uTime * 0.62);
    float wave2 = sin(pos.x * 0.18 - uTime * 0.45 + pos.z * 0.22) * 0.45;
    float wave = wave1 + wave2;
    pos.y += wave * 1.65;

    vColor = aColor;
    vGlow = 0.55 + wave * 0.35;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (280.0 / -mvPosition.z) * (0.85 + wave * 0.35);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = 1.0 - smoothstep(0.0, 0.22, dist);
    float halo = 1.0 - smoothstep(0.08, 0.5, dist);
    float alpha = core * 0.95 + halo * 0.45;
    gl_FragColor = vec4(vColor * (1.0 + halo * 0.6), alpha * vGlow);
  }
`;

function WavePoints() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);

    const purple = new THREE.Color("#8a7bff");
    const blue = new THREE.Color("#4ad6ff");
    const magenta = new THREE.Color("#c25bff");
    const mix = new THREE.Color();

    let i = 0;
    for (let iz = 0; iz < GRID_Z; iz++) {
      for (let ix = 0; ix < GRID_X; ix++) {
        const x = (ix - GRID_X / 2) * SPACING;
        const z = (iz - GRID_Z / 2) * SPACING - 1.2;
        positions[i * 3] = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;

        const t = ix / GRID_X;
        if (t < 0.45) mix.lerpColors(blue, purple, t / 0.45);
        else mix.lerpColors(purple, magenta, (t - 0.45) / 0.55);

        const depthFade = 0.65 + (iz / GRID_Z) * 0.35;
        colors[i * 3] = mix.r * depthFade;
        colors[i * 3 + 1] = mix.g * depthFade;
        colors[i * 3 + 2] = mix.b * depthFade;

        sizes[i] = 1.2 + Math.random() * 2.8;
        i++;
      }
    }

    return { positions, colors, sizes };
  }, []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function PostFX() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={1.35}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.35}
        mipmapBlur
      />
    </EffectComposer>
  );
}

export function ParticleWave() {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 2.8, 6.5], fov: 52, near: 0.1, far: 100 }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={["#050510"]} />
        <fog attach="fog" args={["#050510", 8, 18]} />
        <WavePoints />
        <PostFX />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-[#050510]/30 via-transparent to-[#050510]" />
    </div>
  );
}
