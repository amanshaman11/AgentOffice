"use client";

import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Room } from "./Room";
import { Stage } from "./Stage";
import { AgentSprite } from "./AgentSprite";
import { useAgentStore } from "@/lib/store/agents";
import { semiCircleSlots } from "@/lib/layout";

export default function RoomScene() {
  const agents = useAgentStore((s) => s.agents);
  const slots = semiCircleSlots(agents.length);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#07070d"]} />
      <fog attach="fog" args={["#07070d", 14, 26]} />

      <OrthographicCamera
        makeDefault
        position={[10, 9, 10]}
        zoom={58}
        near={0.1}
        far={100}
      />
      <OrbitControls
        enablePan={false}
        enableZoom
        minZoom={40}
        maxZoom={120}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.4}
        target={[0, 0.8, 0]}
      />

      {/* Lights */}
      <ambientLight intensity={0.35} color="#9aa6ff" />
      <pointLight
        position={[0, 5, 0]}
        intensity={18}
        distance={14}
        color="#b9a8ff"
      />
      <pointLight
        position={[-5, 3, 4]}
        intensity={10}
        distance={10}
        color="#4ad6ff"
      />
      <pointLight
        position={[5, 3, 4]}
        intensity={10}
        distance={10}
        color="#c25bff"
      />

      <Room />
      <Stage />

      {agents.map((agent, i) => (
        <AgentSprite
          key={agent.id}
          roleId={agent.roleId}
          targetPosition={slots[i].position}
        />
      ))}

      <EffectComposer>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
