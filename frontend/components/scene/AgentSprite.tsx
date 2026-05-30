"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { ROLES, type RoleId } from "@/lib/roles";
import type { RunPhase } from "@/lib/store/agents";

interface AgentSpriteProps {
  id: string;
  roleId: RoleId;
  name: string;
  targetPosition: [number, number, number];
  selected: boolean;
  active: boolean;
  phase: RunPhase;
  onSelect: (id: string) => void;
}

const tmpVec = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const STAGE_LOOK = new THREE.Vector3(0, 0, 0);

// Deterministic offset so each agent breathes/bobs out of phase with neighbors
function hashPhase(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export function AgentSprite({
  id,
  roleId,
  name,
  targetPosition,
  selected,
  active,
  phase,
  onSelect,
}: AgentSpriteProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const phaseOffset = useMemo(() => hashPhase(id), [id]);
  const role = ROLES[roleId];

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // Lerp toward the slot/stage position
    tmpVec.set(...targetPosition);
    const lerpSpeed = active && phase === "walking-to-stage" ? 2.2 : 4;
    g.position.lerp(tmpVec, Math.min(1, dt * lerpSpeed));

    // Face the stage (origin)
    tmpLook.copy(STAGE_LOOK);
    tmpLook.y = g.position.y;
    g.lookAt(tmpLook);

    // Idle bob — only when standing still
    const speaking = active && phase === "speaking";
    const standing = !active || phase === "returning" || phase === "idle";
    const bob = standing
      ? Math.sin(t * 1.6 + phaseOffset * Math.PI * 2) * 0.04
      : 0;
    g.position.y = bob;

    // Chest core pulse — bigger when speaking
    if (coreRef.current) {
      const base = 1 + Math.sin(t * 2 + phaseOffset * 6) * 0.06;
      const speakBoost = speaking ? 1.6 + Math.sin(t * 8) * 0.25 : 1;
      const s = base * speakBoost;
      coreRef.current.scale.setScalar(s);
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = speaking ? 5 : 2.4;
    }

    // Ring brightness
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = selected ? 4 : speaking ? 4.5 : 2.5;
    }

    // Speaking shockwave (expanding ring)
    if (pulseRef.current) {
      const mat = pulseRef.current.material as THREE.MeshBasicMaterial;
      if (speaking) {
        const phasePulse = (t * 1.6) % 1;
        pulseRef.current.scale.setScalar(0.6 + phasePulse * 2.2);
        mat.opacity = 0.55 * (1 - phasePulse);
        pulseRef.current.visible = true;
      } else {
        pulseRef.current.visible = false;
      }
    }
  });

  const color = role.color;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(id);
  };

  return (
    <group
      ref={groupRef}
      position={targetPosition}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* Glow ring under feet */}
      <mesh
        ref={ringRef}
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.36, 0.48, 36]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>

      {/* Selection halo */}
      {selected && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.58, 36]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Expanding pulse ring (speaking) */}
      <mesh
        ref={pulseRef}
        position={[0, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.4, 0.45, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* Hover base (no legs — floating) */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.12, 24]} />
        <meshStandardMaterial
          color="#1a1e36"
          roughness={0.5}
          metalness={0.6}
          emissive={color}
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Body (tapered) */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 0.66, 20]} />
        <meshStandardMaterial
          color="#1a1e36"
          roughness={0.45}
          metalness={0.5}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Chest core */}
      <mesh ref={coreRef} position={[0, 0.6, 0.18]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>

      {/* Shoulders */}
      <mesh position={[-0.24, 0.78, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color="#1a1e36"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0.24, 0.78, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial
          color="#1a1e36"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.24, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 12]} />
        <meshStandardMaterial
          color="#1a1e36"
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0.24, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 12]} />
        <meshStandardMaterial
          color="#1a1e36"
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.94, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.08, 12]} />
        <meshStandardMaterial color="#0d0f1a" metalness={0.5} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.07, 0]} castShadow>
        <boxGeometry args={[0.32, 0.26, 0.3]} />
        <meshStandardMaterial
          color="#e6e8ff"
          roughness={0.3}
          metalness={0.4}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Visor */}
      <mesh position={[0, 1.08, 0.16]}>
        <boxGeometry args={[0.26, 0.08, 0.04]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3.2}
          toneMapped={false}
        />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, 1.27, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 8]} />
        <meshStandardMaterial color="#1a1e36" metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>

      {/* Name tag */}
      <Billboard position={[0, 1.7, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.13}
          color="#e6e8ff"
          anchorX="center"
          anchorY="middle"
          outlineColor="#07070d"
          outlineWidth={0.012}
          maxWidth={3}
        >
          {name}
        </Text>
        <Text
          position={[0, -0.15, 0]}
          fontSize={0.08}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineColor="#07070d"
          outlineWidth={0.008}
        >
          {role.name.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}
