"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

interface SpeechBubbleProps {
  message: string;
  color: string;
  visible: boolean;
}

const MAX_CHARS = 60;

function truncateMessage(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHARS) return trimmed;
  return trimmed.slice(0, MAX_CHARS).trimEnd() + "…";
}

export function SpeechBubble({ message, color, visible }: SpeechBubbleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0);
  const opacityRef = useRef(0);
  const displayText = truncateMessage(message);

  useFrame((state, dt) => {
    const group = groupRef.current;
    if (!group) return;

    const targetScale = visible && displayText ? 1 : 0;
    const targetOpacity = visible && displayText ? 1 : 0;
    const speed = visible ? 8 : 12;

    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, dt * speed);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, dt * speed);

    const s = scaleRef.current;
    group.scale.setScalar(Math.max(0.001, s));
    group.visible = s > 0.02;

    const t = state.clock.elapsedTime;
    group.position.y = 1.9 + Math.sin(t * 4) * 0.02 * opacityRef.current;
  });

  if (!displayText) return null;

  return (
    <Billboard
      ref={groupRef}
      position={[0, 1.9, 0]}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group>
        <RoundedBox
          args={[1.4, 0.42, 0.04]}
          radius={0.06}
          smoothness={2}
          position={[0, 0.08, 0]}
        >
          <meshStandardMaterial
            color="#f4f5ff"
            emissive={color}
            emissiveIntensity={0.08}
            transparent
            opacity={0.96}
          />
        </RoundedBox>

        <mesh position={[0, -0.12, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.12, 0.12, 0.02]} />
          <meshStandardMaterial color="#f4f5ff" transparent opacity={0.96} />
        </mesh>

        <mesh position={[0, 0.08, 0.025]}>
          <boxGeometry args={[1.42, 0.44, 0.01]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} />
        </mesh>

        <Text
          position={[0, 0.08, 0.03]}
          fontSize={0.09}
          color="#1a1e36"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.2}
          textAlign="center"
          outlineColor="#f4f5ff"
          outlineWidth={0.004}
        >
          {displayText}
        </Text>
      </group>
    </Billboard>
  );
}
