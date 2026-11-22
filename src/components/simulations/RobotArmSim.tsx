"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { ProgramBar } from "./ProgramBar";

const SERVO_DEG_PER_S = 220;
const REACH = 2.9; // distance from the turning axis to the middle of the jaws
const PICK_DEG = 30;
const DROP_DEG = 150;
const START = { base: 90, grip: 40 };
/** Servo 2: 120° = jaws closed on the brick, 40° = wide open. */
const CLOSED = 120;
const HOLD_FROM = 105;
const RELEASE_BELOW = 85;

const COLORS = { base: "#1d2b4f", arm: "#3b9eff", jaw: "#ffc83d", brick: "#ff6b6b", pick: "#ffd1d1", drop: "#bff5de" };

const angle = (deg: number) => ((deg - 90) * Math.PI) / 180;
/** Position on the floor for a given base servo angle. */
const polar = (deg: number): [number, number] => [REACH * Math.cos(angle(deg)), -REACH * Math.sin(angle(deg))];

type BrickMode = "ground" | "held";

interface Arm {
  base: number;
  grip: number;
  baseTarget: number;
  gripTarget: number;
  brickMode: BrickMode;
  brick: [number, number];
}

const freshArm = (): Arm => ({
  base: START.base, grip: START.grip, baseTarget: START.base, gripTarget: START.grip, brickMode: "ground", brick: polar(PICK_DEG),
});

const sd = (port: string, deg: number) =>
  B.b("snaplab_set_servo_angle", { PORT: port }, { ANGLE: { shadow: B.b("math_number", { NUM: deg }) } });
const wait1 = () => B.b("snaplab_wait_seconds", { SEC: 1 });
/** Picks the brick and carries it over, but never lets go: students must add the release. */
const DEMO = demoProgram(sd("SERVO-1", PICK_DEG), wait1(), sd("SERVO-2", CLOSED), wait1(), sd("SERVO-1", DROP_DEG), wait1());

function Scene({ armRef }: { armRef: React.RefObject<Arm> }) {
  const turret = useRef<THREE.Group>(null);
  const jawL = useRef<THREE.Group>(null);
  const jawR = useRef<THREE.Group>(null);
  const brick = useRef<THREE.Mesh>(null);
  const dropPad = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const a = armRef.current;
    if (!a) return;
    if (turret.current) turret.current.rotation.y = angle(a.base);
    const open = ((CLOSED - a.grip) * 0.5 * Math.PI) / 180;
    if (jawL.current) jawL.current.rotation.y = -open;
    if (jawR.current) jawR.current.rotation.y = open;
    if (brick.current) {
      const [x, z] = a.brickMode === "held" ? polar(a.base) : a.brick;
      brick.current.position.set(x, 0.25, z);
      brick.current.rotation.y = a.brickMode === "held" ? angle(a.base) : 0;
    }
    if (dropPad.current) {
      const [dx, dz] = polar(DROP_DEG);
      const placed = a.brickMode === "ground" && Math.hypot(a.brick[0] - dx, a.brick[1] - dz) < 0.5;
      dropPad.current.color.set(placed ? "#2fd6a0" : COLORS.drop);
    }
  });

  const [px, pz] = polar(PICK_DEG);
  const [dx, dz] = polar(DROP_DEG);
  return (
    <>
      <color attach="background" args={["#e8f6ff"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 4]} intensity={1.2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 48]} />
        <meshStandardMaterial color="#fffaf0" />
      </mesh>
      <mesh position={[px, 0.01, pz]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color={COLORS.pick} />
      </mesh>
      <mesh position={[dx, 0.01, dz]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial ref={dropPad} color={COLORS.drop} />
      </mesh>

      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.1, 0.4, 32]} />
        <meshStandardMaterial color={COLORS.base} />
      </mesh>

      {/* Joint 1: the whole arm turns with Servo 1 */}
      <group ref={turret} position={[0, 0.4, 0]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 1.2, 24]} />
          <meshStandardMaterial color={COLORS.arm} />
        </mesh>
        <mesh position={[REACH / 2 - 0.25, 1.25, 0]} castShadow>
          <boxGeometry args={[REACH - 0.5, 0.28, 0.4]} />
          <meshStandardMaterial color={COLORS.arm} />
        </mesh>
        <mesh position={[REACH - 0.5, 0.85, 0]} castShadow>
          <boxGeometry args={[0.28, 0.8, 0.4]} />
          <meshStandardMaterial color={COLORS.arm} />
        </mesh>

        {/* Joint 2: two jaws closed by Servo 2 through symmetrical gears */}
        <group position={[REACH - 0.5, 0.2, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.4, 0.3, 0.9]} />
            <meshStandardMaterial color={COLORS.base} />
          </mesh>
          <group ref={jawL} position={[0, 0, -0.31]}>
            <mesh position={[0.5, 0, 0]} castShadow>
              <boxGeometry args={[1, 0.5, 0.12]} />
              <meshStandardMaterial color={COLORS.jaw} />
            </mesh>
          </group>
          <group ref={jawR} position={[0, 0, 0.31]}>
            <mesh position={[0.5, 0, 0]} castShadow>
              <boxGeometry args={[1, 0.5, 0.12]} />
              <meshStandardMaterial color={COLORS.jaw} />
            </mesh>
          </group>
        </group>
      </group>

      <mesh ref={brick} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={COLORS.brick} />
      </mesh>

      <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={12} blur={2.5} far={4} />
      <OrbitControls enablePan={false} minDistance={5} maxDistance={14} maxPolarAngle={Math.PI / 2.1} target={[0, 0.8, 0]} />
    </>
  );
}

export default function RobotArmSim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const armRef = useRef<Arm>(freshArm());
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const [, rerender] = useState(0);

  const reset = () => {
    armRef.current = freshArm();
    touchRef.current = Date.now();
    rerender((n) => n + 1);
  };

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: 0 }),
    onStart: () => {
      armRef.current = freshArm();
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  useSimLoop((dt) => {
    const a = armRef.current;
    const out = outRef.current;
    watcher.current.poll(out, "base", out.servo["SERVO-1"], (v) => (a.baseTarget = v));
    watcher.current.poll(out, "grip", out.servo["SERVO-2"], (v) => (a.gripTarget = v));
    a.base = approach(a.base, a.baseTarget, SERVO_DEG_PER_S * dt);
    a.grip = approach(a.grip, a.gripTarget, SERVO_DEG_PER_S * dt);

    const [gx, gz] = polar(a.base);
    if (a.brickMode === "ground" && a.grip >= HOLD_FROM && Math.hypot(a.brick[0] - gx, a.brick[1] - gz) < 0.5) {
      a.brickMode = "held";
    } else if (a.brickMode === "held" && a.grip < RELEASE_BELOW) {
      a.brickMode = "ground";
      a.brick = [gx, gz];
    }
  });

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500,
    () => ({ base_deg: Math.round(armRef.current.base * 10) / 10, grip_deg: Math.round(armRef.current.grip * 10) / 10 }),
    onTelemetry,
  );

  const a = armRef.current;
  const slider = (id: string, label: string, value: number, set: (v: number) => void, color: string) => (
    <div className="rounded-2xl bg-sky/10 p-3">
      <label htmlFor={id} className="flex items-center justify-between font-bold">
        <span>{label}</span>
        <span className="rounded-2xl bg-white px-3 py-1 text-sky">{Math.round(value)}°</span>
      </label>
      <input
        id={id} type="range" min={0} max={180} step={1} value={Math.round(value)}
        onChange={(e) => {
          set(Number(e.target.value));
          touchRef.current = Date.now();
          rerender((n) => n + 1);
        }}
        className="mt-2 h-3 w-full cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[340px] overflow-hidden rounded-2xl border-2 border-ink/10" role="img" aria-label="Cánh tay robot 3D gắp khối gạch">
        <Canvas shadows camera={{ position: [6.5, 5.5, 7.5], fov: 42 }} dpr={[1, 2]}>
          <Scene armRef={armRef} />
        </Canvas>
      </div>
      <p className="text-xs text-ink/60">Kéo để xoay góc nhìn. Vòng hồng là chỗ nhặt, vòng xanh là chỗ thả.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {slider("arm-base", "Servo 1 · xoay đế", a.baseTarget, (v) => (armRef.current.baseTarget = v), "#3b9eff")}
        {slider("arm-grip", "Servo 2 · kẹp", a.gripTarget, (v) => (armRef.current.gripTarget = v), "#ffc83d")}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Đặt lại cánh tay
        </Button>
      </div>
      <ProgramBar program={program} />
    </div>
  );
}
