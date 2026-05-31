"use client";

import * as THREE from "three";
import { useMemo } from "react";

const ROOM_W = 14;
const ROOM_D = 14;
const WALL_H = 4.2;
const FLOOR_THICKNESS = 0.15;

function useCarpetTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#2a2d38";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const v = 40 + Math.random() * 25;
      ctx.fillStyle = `rgba(${v + 10}, ${v + 12}, ${v + 18}, 0.35)`;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const step = size / 8;
    for (let i = 0; i <= 8; i++) {
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
    tex.repeat.set(4, 4);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

function Wall({
  position,
  size,
  rotation = [0, 0, 0] as [number, number, number],
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#3a3f52" roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

function Baseboard({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#8a7bff" emissive="#8a7bff" emissiveIntensity={0.35} roughness={0.5} />
    </mesh>
  );
}

function DeskCluster({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.08, 0.8]} />
        <meshStandardMaterial color="#4a5068" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[1.5, 0.36, 0.7]} />
        <meshStandardMaterial color="#323648" roughness={0.7} metalness={0.05} />
      </mesh>
    </group>
  );
}

function OfficeChair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.42]} />
        <meshStandardMaterial color="#2e3344" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.48, -0.12]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.06]} />
        <meshStandardMaterial color="#3d4460" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.1, 8]} />
        <meshStandardMaterial color="#1a1e2a" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function WindowWall() {
  return (
    <group position={[0, 2.1, -ROOM_D / 2 + 0.12]}>
      <mesh>
        <boxGeometry args={[5.5, 2.4, 0.08]} />
        <meshStandardMaterial color="#1a2030" roughness={0.2} metalness={0.3} />
      </mesh>
      {[-1.6, 0, 1.6].map((x) => (
        <mesh key={x} position={[x, 0, 0.05]}>
          <boxGeometry args={[1.4, 2.1, 0.04]} />
          <meshStandardMaterial
            color="#7eb8ff"
            emissive="#5a9ee8"
            emissiveIntensity={0.45}
            roughness={0.05}
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[5.6, 2.5, 0.02]} />
        <meshBasicMaterial color="#a8d4ff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function Whiteboard() {
  return (
    <group position={[-ROOM_W / 2 + 0.15, 2.0, -1.5]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <boxGeometry args={[2.8, 1.4, 0.06]} />
        <meshStandardMaterial color="#eef0f5" roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[2.5, 1.1, 0.01]} />
        <meshStandardMaterial color="#f8f9fc" emissive="#8a7bff" emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.16, 0.36, 12]} />
        <meshStandardMaterial color="#4a4038" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow>
        <sphereGeometry args={[0.32, 10, 10]} />
        <meshStandardMaterial color="#2d6b4a" roughness={0.85} />
      </mesh>
    </group>
  );
}

export function Room() {
  const carpet = useCarpetTexture();
  const halfW = ROOM_W / 2;
  const halfD = ROOM_D / 2;

  return (
    <group>
      <mesh receiveShadow position={[0, -FLOOR_THICKNESS / 2, 0]}>
        <boxGeometry args={[ROOM_W, FLOOR_THICKNESS, ROOM_D]} />
        <meshStandardMaterial color="#22252f" roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[ROOM_W - 0.2, ROOM_D - 0.2]} />
        <meshStandardMaterial map={carpet ?? undefined} color="#2a2d38" roughness={0.95} />
      </mesh>

      <Wall position={[0, WALL_H / 2, -halfD]} size={[ROOM_W, WALL_H, 0.2]} />
      <Wall position={[-halfW, WALL_H / 2, 0]} size={[0.2, WALL_H, ROOM_D]} />
      <Wall position={[halfW, WALL_H / 2, 0]} size={[0.2, WALL_H, ROOM_D]} />

      <Baseboard position={[0, 0.12, -halfD + 0.12]} size={[ROOM_W, 0.12, 0.08]} />
      <Baseboard position={[-halfW + 0.12, 0.12, 0]} size={[0.08, 0.12, ROOM_D]} />
      <Baseboard position={[halfW - 0.12, 0.12, 0]} size={[0.08, 0.12, ROOM_D]} />

      <mesh receiveShadow position={[0, WALL_H + 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#1e212c" roughness={0.9} />
      </mesh>

      <WindowWall />
      <Whiteboard />

      <DeskCluster position={[-3.8, 0, -3.2]} />
      <DeskCluster position={[3.8, 0, -3.2]} />
      <DeskCluster position={[0, 0, -4.2]} />

      <OfficeChair position={[-3.8, 0, -2.4]} rotation={Math.PI} />
      <OfficeChair position={[3.8, 0, -2.4]} rotation={Math.PI} />
      <OfficeChair position={[0, 0, -3.4]} rotation={Math.PI} />

      <Plant position={[halfW - 0.8, 0, -halfD + 0.8]} />
      <Plant position={[-halfW + 0.8, 0, halfD - 0.8]} />

      <mesh position={[0, 0.015, halfD - 0.15]}>
        <boxGeometry args={[ROOM_W - 0.4, 0.03, 0.06]} />
        <meshStandardMaterial color="#8a7bff" emissive="#8a7bff" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}
