"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls } from "@react-three/drei";
import { useShallow } from "zustand/shallow";
import { Room } from "./Room";
import { Stage } from "./Stage";
import { AgentSprite } from "./AgentSprite";
import { Effects } from "./Effects";
import {
  useAgentStore,
  selectActiveAgents,
} from "@/lib/store/agents";
import { semiCircleSlots, STAGE_POSITION } from "@/lib/layout";

export default function RoomScene() {
  const agents = useAgentStore(useShallow(selectActiveAgents));
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const run = useAgentStore((s) => s.run);

  const slots = semiCircleSlots(agents.length);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      style={{ width: "100%", height: "100%" }}
      onPointerMissed={() => selectAgent(null)}
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

      <Suspense fallback={null}>
        <Room />
        <Stage />
      </Suspense>

      {agents.map((agent, i) => {
        const isActive = run.activeAgentId === agent.id;
        const isOnStage =
          isActive && (run.phase === "walking-to-stage" || run.phase === "speaking");
        const target: [number, number, number] = isOnStage
          ? STAGE_POSITION
          : (slots[i]?.position ?? [0, 0, 0]);
        return (
          <AgentSprite
            key={agent.id}
            id={agent.id}
            roleId={agent.roleId}
            name={agent.name}
            targetPosition={target}
            selected={selectedAgentId === agent.id}
            active={isActive}
            phase={isActive ? run.phase : "idle"}
            onSelect={selectAgent}
          />
        );
      })}

      <Effects />
    </Canvas>
  );
}
