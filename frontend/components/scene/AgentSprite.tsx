"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { getRole, type RoleId } from "@/lib/roles";
import type { RunPhase } from "@/lib/store/agents";
import { SpeechBubble } from "./SpeechBubble";

interface AgentSpriteProps {
  id: string;
  roleId: RoleId;
  name: string;
  targetPosition: [number, number, number];
  selected: boolean;
  active: boolean;
  phase: RunPhase;
  message?: string;
  showBubble?: boolean;
  onSelect: (id: string) => void;
}

const tmpVec = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const STAGE_LOOK = new THREE.Vector3(0, 0, 0);

function hashPhase(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

const bodyMat = { color: "#1a1e36", roughness: 0.35, metalness: 0.75 };
const limbMat = { color: "#1a1e36", roughness: 0.35, metalness: 0.7 };

export function AgentSprite({
  id,
  roleId,
  name,
  targetPosition,
  selected,
  active,
  phase,
  message = "",
  showBubble = false,
  onSelect,
}: AgentSpriteProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const phaseOffset = useMemo(() => hashPhase(id), [id]);
  const role = getRole(roleId);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    tmpVec.set(...targetPosition);
    const lerpSpeed = active && phase === "walking-to-stage" ? 2.2 : 4;
    g.position.lerp(tmpVec, Math.min(1, dt * lerpSpeed));

    tmpLook.copy(STAGE_LOOK);
    tmpLook.y = g.position.y;
    g.lookAt(tmpLook);

    const speaking = active && phase === "speaking";
    const standing = !active || phase === "returning" || phase === "idle";
    const bob = standing
      ? Math.sin(t * 1.6 + phaseOffset * Math.PI * 2) * 0.04
      : 0;
    g.position.y = bob;

    if (bodyRef.current) {
      const breath = speaking
        ? 1 + Math.sin(t * 6) * 0.03
        : 1 + Math.sin(t * 1.2 + phaseOffset * 6) * 0.015;
      bodyRef.current.scale.set(breath, breath, breath);
    }

    if (coreRef.current) {
      const base = 1 + Math.sin(t * 2 + phaseOffset * 6) * 0.06;
      const speakBoost = speaking ? 1.6 + Math.sin(t * 8) * 0.25 : 1;
      const s = base * speakBoost;
      coreRef.current.scale.setScalar(s);
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = speaking ? 5 : 2.4;
    }

    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = selected ? 4 : speaking ? 4.5 : 2.5;
    }

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
  const speaking = active && phase === "speaking";

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
      <mesh
        ref={ringRef}
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.36, 0.48, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>

      {selected && (
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.58, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} />
        </mesh>
      )}

      <mesh
        ref={pulseRef}
        position={[0, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.4, 0.45, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      <group ref={bodyRef}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.28, 0.32, 0.12, 6]} />
          <meshStandardMaterial
            {...bodyMat}
            emissive={color}
            emissiveIntensity={0.4}
          />
        </mesh>

        <mesh position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.52, 0.2, 0.4]} />
          <meshStandardMaterial
            {...bodyMat}
            emissive={color}
            emissiveIntensity={0.2}
          />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.44, 0.2, 0.36]} />
          <meshStandardMaterial
            {...bodyMat}
            emissive={color}
            emissiveIntensity={0.22}
          />
        </mesh>
        <mesh position={[0, 0.68, 0]} castShadow>
          <boxGeometry args={[0.36, 0.2, 0.32]} />
          <meshStandardMaterial
            {...bodyMat}
            emissive={color}
            emissiveIntensity={0.25}
          />
        </mesh>

        <mesh ref={coreRef} position={[0, 0.58, 0.2]}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[-0.28, 0.78, 0]}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshStandardMaterial {...limbMat} />
        </mesh>
        <mesh position={[0.28, 0.78, 0]}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshStandardMaterial {...limbMat} />
        </mesh>

        <mesh position={[-0.28, 0.58, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial {...limbMat} />
        </mesh>
        <mesh position={[0.28, 0.58, 0]}>
          <boxGeometry args={[0.1, 0.4, 0.1]} />
          <meshStandardMaterial {...limbMat} />
        </mesh>

        <mesh position={[0, 0.92, 0]}>
          <boxGeometry args={[0.1, 0.08, 0.1]} />
          <meshStandardMaterial color="#0d0f1a" metalness={0.75} roughness={0.35} />
        </mesh>

        <mesh position={[0, 1.08, 0]} castShadow>
          <boxGeometry args={[0.36, 0.3, 0.34]} />
          <meshStandardMaterial
            color="#e6e8ff"
            roughness={0.25}
            metalness={0.75}
            emissive={color}
            emissiveIntensity={0.15}
          />
        </mesh>

        <mesh position={[0, 1.1, 0.18]}>
          <boxGeometry args={[0.3, 0.12, 0.06]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={3.2}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0, 1.28, 0]}>
          <boxGeometry args={[0.024, 0.16, 0.024]} />
          <meshStandardMaterial color="#1a1e36" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.38, 0]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
      </group>

      <SpeechBubble message={message} color={color} visible={showBubble || speaking} />

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
