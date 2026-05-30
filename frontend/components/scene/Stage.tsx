"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

/**
 * The focal pad in the center of the semi-circle that the agents face.
 */
export function Stage() {
  const ringRef = useRef<Mesh>(null);

  useFrame((_, dt) => {
    if (ringRef.current) ringRef.current.rotation.z += dt * 0.4;
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Base pad */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 64]} />
        <meshStandardMaterial
          color="#14172a"
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Glowing ring */}
      <mesh ref={ringRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1.0, 64]} />
        <meshStandardMaterial
          color="#8a7bff"
          emissive="#8a7bff"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>

      {/* Floating cube core */}
      <FloatingCore />
    </group>
  );
}

function FloatingCore() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.y = 0.7 + Math.sin(t * 1.2) * 0.08;
    meshRef.current.rotation.x = t * 0.4;
    meshRef.current.rotation.y = t * 0.6;
  });

  return (
    <mesh ref={meshRef} position={[0, 0.7, 0]}>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial
        color="#4ad6ff"
        emissive="#4ad6ff"
        emissiveIntensity={2.4}
        toneMapped={false}
      />
    </mesh>
  );
}
