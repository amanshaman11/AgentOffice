"use client";

import * as THREE from "three";
import { useMemo } from "react";

const FLOOR_SIZE = 14;
const FLOOR_THICKNESS = 0.2;

export function Room() {
  const gridTexture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#0d0f1a";
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(74, 214, 255, 0.18)";
    ctx.lineWidth = 1;
    const step = size / 16;
    for (let i = 0; i <= 16; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }, []);

  return (
    <group>
      {/* Floor slab */}
      <mesh
        receiveShadow
        position={[0, -FLOOR_THICKNESS / 2, 0]}
      >
        <boxGeometry args={[FLOOR_SIZE, FLOOR_THICKNESS, FLOOR_SIZE]} />
        <meshStandardMaterial
          color="#0b0d18"
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      {/* Grid overlay */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
      >
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshBasicMaterial
          map={gridTexture ?? undefined}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Neon floor border */}
      <FloorBorder size={FLOOR_SIZE} />
    </group>
  );
}

function FloorBorder({ size }: { size: number }) {
  const half = size / 2;
  const y = 0.02;
  const t = 0.06;
  const h = 0.04;
  return (
    <group>
      {/* front */}
      <mesh position={[0, y, half - t / 2]}>
        <boxGeometry args={[size, h, t]} />
        <meshStandardMaterial
          color="#4ad6ff"
          emissive="#4ad6ff"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
      {/* back */}
      <mesh position={[0, y, -half + t / 2]}>
        <boxGeometry args={[size, h, t]} />
        <meshStandardMaterial
          color="#4ad6ff"
          emissive="#4ad6ff"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
      {/* left */}
      <mesh position={[-half + t / 2, y, 0]}>
        <boxGeometry args={[t, h, size]} />
        <meshStandardMaterial
          color="#4ad6ff"
          emissive="#4ad6ff"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
      {/* right */}
      <mesh position={[half - t / 2, y, 0]}>
        <boxGeometry args={[t, h, size]} />
        <meshStandardMaterial
          color="#4ad6ff"
          emissive="#4ad6ff"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
