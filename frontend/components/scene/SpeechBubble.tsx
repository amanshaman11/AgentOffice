"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

interface SpeechBubbleProps {
  message: string;
  color: string;
  visible: boolean;
}

const MAX_CHARS = 72;
const LINGER_SECONDS = 3.5;
const FADE_SECONDS = 1;

type BubblePhase = "hidden" | "show" | "linger" | "fade";

function truncateMessage(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHARS) return trimmed;
  return trimmed.slice(0, MAX_CHARS).trimEnd() + "…";
}

export function SpeechBubble({ message, color, visible }: SpeechBubbleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const boxMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const tailMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const rimMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const scaleRef = useRef(0);
  const opacityRef = useRef(0);
  const phaseRef = useRef<BubblePhase>("hidden");
  const timerRef = useRef(0);

  const [text, setText] = useState("");

  useEffect(() => {
    const trimmed = truncateMessage(message);

    if (visible && trimmed) {
      setText(trimmed);
      phaseRef.current = "show";
      timerRef.current = 0;
      return;
    }

    if (text && phaseRef.current === "show") {
      phaseRef.current = "linger";
      timerRef.current = 0;
    }
  }, [visible, message, text]);

  useFrame((state, dt) => {
    const group = groupRef.current;
    if (!group) return;

    const phase = phaseRef.current;

    if (phase === "linger") {
      timerRef.current += dt;
      if (timerRef.current >= LINGER_SECONDS) {
        phaseRef.current = "fade";
        timerRef.current = 0;
      }
    } else if (phase === "fade") {
      timerRef.current += dt;
      if (timerRef.current >= FADE_SECONDS) {
        phaseRef.current = "hidden";
        timerRef.current = 0;
        setText("");
      }
    }

    let targetOpacity = 0;
    let targetScale = 0;

    if (phase === "show" || phase === "linger") {
      targetOpacity = 1;
      targetScale = 1;
    } else if (phase === "fade") {
      const t = timerRef.current / FADE_SECONDS;
      targetOpacity = 1 - t;
      targetScale = 1 - t * 0.08;
    }

    const inSpeed = phase === "show" ? 10 : 6;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, dt * inSpeed);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, dt * (phase === "fade" ? 5 : inSpeed));

    const s = scaleRef.current;
    const o = opacityRef.current;
    group.scale.setScalar(Math.max(0.001, s));
    group.visible = s > 0.02 && o > 0.02 && Boolean(text);

    if (boxMatRef.current) boxMatRef.current.opacity = 0.98 * o;
    if (tailMatRef.current) tailMatRef.current.opacity = 0.98 * o;
    if (rimMatRef.current) rimMatRef.current.opacity = 0.4 * o;

    contentRef.current?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if ("opacity" in mat) {
          mat.opacity = o;
          mat.transparent = true;
        }
      }
    });

    const bob = state.clock.elapsedTime;
    group.position.y = 2.05 + Math.sin(bob * 3.5) * 0.015 * o;
  });

  if (!text) return null;

  return (
    <Billboard
      ref={groupRef}
      position={[0, 2.05, 0]}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group ref={contentRef}>
        <RoundedBox
          args={[1.85, 0.58, 0.04]}
          radius={0.08}
          smoothness={3}
          position={[0, 0.1, 0]}
        >
          <meshStandardMaterial
            ref={boxMatRef}
            color="#ffffff"
            emissive={color}
            emissiveIntensity={0.12}
            transparent
            opacity={0.98}
          />
        </RoundedBox>

        <mesh position={[0, -0.16, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.14, 0.14, 0.02]} />
          <meshStandardMaterial ref={tailMatRef} color="#ffffff" transparent opacity={0.98} />
        </mesh>

        <mesh position={[0, 0.1, 0.025]}>
          <boxGeometry args={[1.88, 0.6, 0.01]} />
          <meshBasicMaterial ref={rimMatRef} color={color} transparent opacity={0.4} />
        </mesh>

        <Text
          position={[0, 0.1, 0.03]}
          fontSize={0.115}
          color="#0b1020"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.55}
          lineHeight={1.25}
          textAlign="center"
          outlineColor="#ffffff"
          outlineWidth={0.012}
          fillOpacity={1}
        >
          {text}
        </Text>
      </group>
    </Billboard>
  );
}
