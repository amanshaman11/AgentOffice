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

const SCENE_Y_OFFSET = -0.5;

export default function RoomScene() {
  const agents = useAgentStore(useShallow(selectActiveAgents));
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const run = useAgentStore((s) => s.run);

  const slots = semiCircleSlots(agents.length);

  const activeMessage = (() => {
    if (!run.activeAgentId) return "";
    if (run.phase !== "speaking" && run.phase !== "returning") return "";
    for (let i = run.log.length - 1; i >= 0; i--) {
      const step = run.log[i];
      if (step.agentId === run.activeAgentId && step.message) return step.message;
    }
    return "";
  })();

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      style={{ width: "100%", height: "100%" }}
      onPointerMissed={() => selectAgent(null)}
    >
      <color attach="background" args={["#12151f"]} />
      <fog attach="fog" args={["#12151f", 16, 28]} />

      <OrthographicCamera
        makeDefault
        position={[10, 9, 10]}
        zoom={54}
        near={0.1}
        far={100}
      />
      <OrbitControls
        enablePan={false}
        enableZoom
        minZoom={38}
        maxZoom={110}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.35}
        target={[0, 0.55, 0]}
      />

      <ambientLight intensity={0.42} color="#c8d0e8" />
      <directionalLight
        position={[4, 8, 6]}
        intensity={1.1}
        color="#fff4e8"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 3.7, 0]} intensity={10} distance={14} color="#eef1ff" />
      <pointLight position={[0, 3.8, -5]} intensity={14} distance={12} color="#a8c8ff" />
      <pointLight position={[-4, 2.5, 2]} intensity={6} distance={10} color="#8a7bff" />
      <pointLight position={[4, 2.5, 2]} intensity={5} distance={10} color="#4ad6ff" />

      <group position={[0, SCENE_Y_OFFSET, 0]}>
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
              message={isActive ? activeMessage : ""}
              showBubble={isActive && (run.phase === "speaking" || run.phase === "returning")}
              onSelect={selectAgent}
            />
          );
        })}
      </group>

      <Effects />
    </Canvas>
  );
}
