"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROLES, type RoleId } from "@/lib/roles";

interface AgentSpriteProps {
  roleId: RoleId;
  targetPosition: [number, number, number];
  selected?: boolean;
}

const tmpVec = new THREE.Vector3();
const tmpLook = new THREE.Vector3(0, 0, 0);

export function AgentSprite({
  roleId,
  targetPosition,
  selected,
}: AgentSpriteProps) {
  const groupRef = useRef<THREE.Group>(null);
  const role = ROLES[roleId];

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    tmpVec.set(...targetPosition);
    // Smooth lerp toward target so re-shuffling animates
    g.position.lerp(tmpVec, Math.min(1, dt * 4));
    // Face the origin (stage) — keep head level by zeroing y target
    tmpLook.set(0, g.position.y, 0);
    g.lookAt(tmpLook);
  });

  const color = role.color;
  const emissiveIntensity = selected ? 2.2 : 1.4;

  return (
    <group ref={groupRef} position={targetPosition}>
      {/* Glow ring under feet */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>

      {/* Body */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.5, 4, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity * 0.35}
          roughness={0.45}
          metalness={0.25}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial
          color="#e6e8ff"
          emissive={color}
          emissiveIntensity={emissiveIntensity * 0.4}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>

      {/* Visor */}
      <mesh position={[0, 1.12, 0.14]}>
        <boxGeometry args={[0.22, 0.06, 0.04]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
