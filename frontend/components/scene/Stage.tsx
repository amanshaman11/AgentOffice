"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

export function Stage() {
  const ringRef = useRef<Mesh>(null);

  useFrame((_, dt) => {
    if (ringRef.current) ringRef.current.rotation.z += dt * 0.25;
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.35, 0.06, 48]} />
        <meshStandardMaterial color="#3d4460" roughness={0.45} metalness={0.25} />
      </mesh>

      <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.28, 64]} />
        <meshStandardMaterial color="#2a2f42" roughness={0.5} metalness={0.2} />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.12, 64]} />
        <meshStandardMaterial color="#8a7bff" emissive="#8a7bff" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
    </group>
  );
}
