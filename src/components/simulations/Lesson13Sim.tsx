"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CircleDot, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

// World units: x = forward at heading 0, z = to the car's right, y = up. Heading grows clockwise seen from above.
const FLOOR = { hx: 6, hz: 3.5 };
const START = { x: -4.2, z: 0, heading: 0 };
const OBJECT_START = { x: -1.2, z: 0 };
const OBJECT_HALF = 0.35;
const TARGET = { x: 3, z: 0, hx: 1, hz: 1.3 };

const MAX_SPEED = 2.6; // world units per second at 100% on both wheels
const MAX_TURN_DEG = 120; // degrees per second at +100% / -100%
const WHEEL_RADIUS = 0.38;
const SERVO_DEG_PER_S = 220;

/** Scoop rules: 0° = raised, 55–80° = resting on the floor, above 80° = pressing so hard the front wheels lift. */
const SCOOP_FLOOR_MIN = 55;
const SCOOP_FLOOR_MAX = 80;
const LIFT_PITCH = (9 * Math.PI) / 180;
const LIFT_SPIN_BOOST = 3.5;

// Scoop geometry in the car's local frame.
const ARM_PIVOT = { x: 0.9, y: 0.85 };
const ARM_LENGTH = 1;
const BLADE_FRONT = 1.5; // front face of the plate while it rests on the floor
const BLADE_HALF_WIDTH = 0.75;
const BODY_FRONT = 0.9;

const COLORS = { body: "#ffc83d", dark: "#1d2b4f", blade: "#3b9eff", object: "#ff6b6b", zone: "#bff5de", zoneDone: "#2fd6a0" };

type Drive = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";
type Status = "idle" | "lifted" | "slipped" | "delivered";

interface Sim {
  x: number;
  z: number;
  heading: number;
  left: number;
  right: number;
  servo: number;
  servoTarget: number;
  pitch: number;
  spinL: number;
  spinR: number;
  ox: number;
  oz: number;
  oRot: number;
  lifted: boolean;
  slipped: boolean;
  delivered: boolean;
}

const freshSim = (): Sim => ({
  ...START, left: 0, right: 0, servo: 0, servoTarget: 0, pitch: 0, spinL: 0, spinR: 0,
  ox: OBJECT_START.x, oz: OBJECT_START.z, oRot: 0, lifted: false, slipped: false, delivered: false,
});

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Names the movement from the two wheel speeds, using the same words as the lesson's `drive` telemetry. */
function classifyDrive(left: number, right: number): Drive {
  if (left === 0 && right === 0) return "STOP";
  const avg = (left + right) / 2;
  const diff = left - right;
  if (Math.abs(diff) > 20 && Math.abs(diff) >= Math.abs(avg)) return diff > 0 ? "RIGHT" : "LEFT";
  return avg >= 0 ? "FORWARD" : "BACKWARD";
}

function statusOf(s: Sim): Status {
  if (s.lifted) return "lifted";
  if (s.delivered) return "delivered";
  if (s.slipped) return "slipped";
  return "idle";
}

const STATUS_TEXT: Record<Status, string> = {
  idle: "Hãy thử hạ gầu xuống rồi cho xe tiến lên nhé.",
  lifted:
    "Ối! Bánh trước bị nhấc lên khỏi sàn, bánh quay tít mà xe vẫn đứng yên. Con thử nhìn xem: gầu đang ép xuống sàn mạnh hay nhẹ? Nếu gầu chống mạnh quá thì đầu xe sẽ ra sao nhỉ?",
  slipped:
    "Xe đã chạy qua mà khối gỗ vẫn nằm yên chỗ cũ! Con thử quan sát: lúc xe đi tới, gầu đang ở cao hay thấp so với mặt sàn? Gầu có chạm được vào khối không nhỉ?",
  delivered: "Giỏi quá! Khối gỗ đã nằm gọn trong vùng đích rồi.",
};

const sd = (deg: number) =>
  B.b("snaplab_set_servo_angle", { PORT: "SERVO-1" }, { ANGLE: { shadow: B.b("math_number", { NUM: deg }) } });
const drive = (dir: Drive) => B.b("snaplab_drive_motors", { DIR: dir });
/** Lower the scoop to 70°, drive forward for a little over 3 seconds, stop and raise the scoop again. */
const DEMO = demoProgram(sd(70), B.b("snaplab_wait_seconds", { SEC: 0.6 }), drive("FORWARD"), B.b("snaplab_wait_seconds", { SEC: 3.3 }), drive("STOP"), sd(0));

function Wheel({ groupRef, z }: { groupRef: React.RefObject<THREE.Group | null>; z: number }) {
  return (
    <group ref={groupRef} position={[0.5, WHEEL_RADIUS, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.22, 24]} />
        <meshStandardMaterial color={COLORS.dark} />
      </mesh>
      {/* a bright bar so the spin is easy to see */}
      <mesh position={[0, 0, Math.sign(z) * 0.12]}>
        <boxGeometry args={[WHEEL_RADIUS * 1.5, 0.1, 0.03]} />
        <meshStandardMaterial color="#d6ecff" />
      </mesh>
    </group>
  );
}

function Scene({ simRef }: { simRef: React.RefObject<Sim> }) {
  const car = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Group>(null);
  const wheelL = useRef<THREE.Group>(null);
  const wheelR = useRef<THREE.Group>(null);
  const block = useRef<THREE.Mesh>(null);
  const zone = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const s = simRef.current;
    if (!s) return;
    car.current?.position.set(s.x, 0, s.z);
    if (car.current) car.current.rotation.y = -rad(s.heading);
    if (tilt.current) tilt.current.rotation.z = s.pitch;
    if (arm.current) arm.current.rotation.z = -rad(s.servo);
    if (plate.current) plate.current.rotation.z = rad(s.servo);
    if (wheelL.current) wheelL.current.rotation.z = -s.spinL;
    if (wheelR.current) wheelR.current.rotation.z = -s.spinR;
    if (block.current) {
      block.current.position.set(s.ox, OBJECT_HALF, s.oz);
      block.current.rotation.y = -rad(s.oRot);
    }
    zone.current?.color.set(s.delivered ? COLORS.zoneDone : COLORS.zone);
  });

  return (
    <>
      <color attach="background" args={["#e8f6ff"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 4]} intensity={1.2} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FLOOR.hx * 2, FLOOR.hz * 2]} />
        <meshStandardMaterial color="#fffaf0" />
      </mesh>
      <mesh position={[TARGET.x, 0.01, TARGET.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TARGET.hx * 2, TARGET.hz * 2]} />
        <meshStandardMaterial ref={zone} color={COLORS.zone} />
      </mesh>

      <group ref={car}>
        {/* Everything tips around the rear support ball when the front wheels lift */}
        <group position={[-0.75, 0.15, 0]} ref={tilt}>
          <group position={[0.75, -0.15, 0]}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[1.7, 0.4, 1.1]} />
              <meshStandardMaterial color={COLORS.body} />
            </mesh>
            <mesh position={[-0.2, 0.82, 0]} castShadow>
              <boxGeometry args={[0.7, 0.25, 0.6]} />
              <meshStandardMaterial color={COLORS.dark} />
            </mesh>
            <mesh position={[-0.75, 0.15, 0]} castShadow>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshStandardMaterial color={COLORS.dark} />
            </mesh>
            <Wheel groupRef={wheelL} z={-0.7} />
            <Wheel groupRef={wheelR} z={0.7} />

            {[-0.45, 0.45].map((z) => (
              <mesh key={z} position={[ARM_PIVOT.x - 0.05, 0.78, z]}>
                <boxGeometry args={[0.1, 0.3, 0.1]} />
                <meshStandardMaterial color={COLORS.dark} />
              </mesh>
            ))}
            {/* Scoop: two arms swing down with SERVO-1, the plate stays upright */}
            <group ref={arm} position={[ARM_PIVOT.x, ARM_PIVOT.y, 0]}>
              {[-0.45, 0.45].map((z) => (
                <mesh key={z} position={[ARM_LENGTH / 2, 0, z]} castShadow>
                  <boxGeometry args={[ARM_LENGTH, 0.1, 0.1]} />
                  <meshStandardMaterial color={COLORS.blade} />
                </mesh>
              ))}
              <group ref={plate} position={[ARM_LENGTH, 0, 0]}>
                <mesh position={[0.05, 0.25, 0]} castShadow>
                  <boxGeometry args={[0.1, 0.5, BLADE_HALF_WIDTH * 2]} />
                  <meshStandardMaterial color={COLORS.blade} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>

      <mesh ref={block} castShadow>
        <boxGeometry args={[OBJECT_HALF * 2, OBJECT_HALF * 2, OBJECT_HALF * 2]} />
        <meshStandardMaterial color={COLORS.object} />
      </mesh>

      <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={14} blur={2.5} far={4} />
      <OrbitControls enablePan={false} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI / 2.1} target={[0, 0.5, 0]} />
    </>
  );
}

interface Hud {
  servo: number;
  left: number;
  right: number;
  status: Status;
}

export default function Lesson13Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  // The simulation state lives in a ref: the physics loop and the 3D frame loop never touch React state.
  const simRef = useRef<Sim>(freshSim());
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const [hud, setHud] = useState<Hud>({ servo: 0, left: 0, right: 0, status: "idle" });
  const [buttonHint, setButtonHint] = useState(false);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: 0 }),
    onStart: () => {
      simRef.current = freshSim();
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  const setWheels = (left: number, right: number) => {
    simRef.current.left = left;
    simRef.current.right = right;
    // Mirror into the program outputs so the next identical write from a block is seen as a change.
    outRef.current.motor["MOTOR-A"] = left;
    outRef.current.motor["MOTOR-B"] = right;
    touchRef.current = Date.now();
  };

  const reset = () => {
    simRef.current = freshSim();
    touchRef.current = Date.now();
  };

  const pressA = () => {
    if (program.hasButtonHandler("A")) {
      setButtonHint(false);
      touchRef.current = Date.now();
      program.fireButton("A");
    } else {
      setButtonHint(true);
    }
  };
  const pressARef = useRef(pressA);
  pressARef.current = pressA;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== "a") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      pressARef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useSimLoop((dt) => {
    const s = simRef.current;
    const out = outRef.current;
    const touch = () => (touchRef.current = Date.now());
    watcher.current.poll(out, "motor-a", out.motor["MOTOR-A"], (v) => { s.left = clamp(v, -100, 100); touch(); });
    watcher.current.poll(out, "motor-b", out.motor["MOTOR-B"], (v) => { s.right = clamp(v, -100, 100); touch(); });
    watcher.current.poll(out, "servo-1", out.servo["SERVO-1"], (v) => { s.servoTarget = clamp(v, 0, 180); touch(); });
    s.servo = approach(s.servo, s.servoTarget, SERVO_DEG_PER_S * dt);

    // Rule: pressing the scoop harder than 80° props the front wheels in the air, so the car cannot drive.
    s.lifted = s.servo > SCOOP_FLOOR_MAX;
    const scoopOnFloor = s.servo >= SCOOP_FLOOR_MIN && !s.lifted;
    s.pitch = approach(s.pitch, clamp((s.servo - SCOOP_FLOOR_MAX) / 5, 0, 1) * LIFT_PITCH, rad(40) * dt);

    // Each wheel turns with its own speed; spinning in the air is much faster because there is no load.
    const spin = (speed: number) => ((speed / 100) * MAX_SPEED * dt / WHEEL_RADIUS) * (s.lifted ? LIFT_SPIN_BOOST : 1);
    s.spinL += spin(s.left);
    s.spinR += spin(s.right);

    if (!s.lifted) {
      // Differential drive: the average of the wheels moves the car, their difference turns it.
      const forward = ((s.left + s.right) / 200) * MAX_SPEED * dt;
      s.heading = (s.heading + ((s.left - s.right) / 200) * MAX_TURN_DEG * dt + 360) % 360;
      const h = rad(s.heading);
      s.x = clamp(s.x + Math.cos(h) * forward, -FLOOR.hx + 0.8, FLOOR.hx - 0.8);
      s.z = clamp(s.z + Math.sin(h) * forward, -FLOOR.hz + 0.8, FLOOR.hz - 0.8);
    }

    // The scoop only pushes the block when it rests on the floor; a raised scoop glides over it.
    const h = rad(s.heading);
    const c = Math.cos(h);
    const sn = Math.sin(h);
    const dx = s.ox - s.x;
    const dz = s.oz - s.z;
    let lx = dx * c + dz * sn;
    const lz = -dx * sn + dz * c;
    if (scoopOnFloor) {
      s.slipped = false;
      if (lx > BODY_FRONT && lx < BLADE_FRONT + OBJECT_HALF && Math.abs(lz) < BLADE_HALF_WIDTH + OBJECT_HALF) {
        lx = BLADE_FRONT + OBJECT_HALF;
        s.ox = clamp(s.x + lx * c - lz * sn, -FLOOR.hx + OBJECT_HALF, FLOOR.hx - OBJECT_HALF);
        s.oz = clamp(s.z + lx * sn + lz * c, -FLOOR.hz + OBJECT_HALF, FLOOR.hz - OBJECT_HALF);
        s.oRot = s.heading;
      }
    } else if (s.servo < SCOOP_FLOOR_MIN && lx > -0.3 && lx < BODY_FRONT && Math.abs(lz) < BLADE_HALF_WIDTH) {
      s.slipped = true;
    }
    s.delivered = Math.abs(s.ox - TARGET.x) <= TARGET.hx && Math.abs(s.oz - TARGET.z) <= TARGET.hz;
  });

  // Low-rate snapshot for the React side (status text and readouts); only re-renders when something changed.
  useEffect(() => {
    const id = setInterval(() => {
      const s = simRef.current;
      const next: Hud = { servo: Math.round(s.servo), left: Math.round(s.left), right: Math.round(s.right), status: statusOf(s) };
      setHud((p) => (p.servo === next.servo && p.left === next.left && p.right === next.right && p.status === next.status ? p : next));
    }, 120);
    return () => clearInterval(id);
  }, []);

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500 || simRef.current.left !== 0 || simRef.current.right !== 0 ||
      simRef.current.servo !== simRef.current.servoTarget,
    () => {
      const s = simRef.current;
      return {
        servo_deg: Math.round(s.servo * 10) / 10,
        drive: classifyDrive(s.left, s.right),
        wheels_lifted: s.lifted ? 1 : 0,
        object_delivered: s.delivered ? 1 : 0,
        left_speed: Math.round(s.left),
        right_speed: Math.round(s.right),
      };
    },
    onTelemetry,
  );

  const warn = hud.status === "lifted" || hud.status === "slipped";

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[340px] overflow-hidden rounded-2xl border-2 border-ink/10" role="img" aria-label="Xe ủi 3D đẩy khối gỗ tới vùng đích màu xanh">
        <Canvas shadows camera={{ position: [-1, 6.5, 9], fov: 42 }} dpr={[1, 2]}>
          <Scene simRef={simRef} />
        </Canvas>
      </div>
      <p className="text-xs text-ink/60">Kéo để xoay góc nhìn. Hãy đẩy khối đỏ vào vùng xanh nhé!</p>

      <p
        aria-live="polite"
        className={cn("rounded-2xl p-3 font-bold", warn ? "bg-coral/15 text-ink" : hud.status === "delivered" ? "bg-mint/25" : "bg-sky/10")}
      >
        {STATUS_TEXT[hud.status]}
      </p>

      <div className="grid gap-2 text-sm font-bold sm:grid-cols-3">
        <p className="rounded-2xl bg-sun/20 p-2 text-center">Gầu (SERVO-1): <span className="tabular-nums">{hud.servo}°</span></p>
        <p className="rounded-2xl bg-sky/10 p-2 text-center">Bánh trái (A): <span className="tabular-nums">{hud.left}%</span></p>
        <p className="rounded-2xl bg-sky/10 p-2 text-center">Bánh phải (B): <span className="tabular-nums">{hud.right}%</span></p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-sun/20 p-3">
        <Button variant="outline" size="sm" onClick={pressA} aria-keyshortcuts="A">
          <CircleDot className="h-4 w-4" aria-hidden /> Nút A
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWheels(0, 0)}>
          <Square className="h-4 w-4" aria-hidden /> Phanh
        </Button>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Đặt lại
        </Button>
        <span className="text-xs text-ink/70">Bấm phím A cũng được nhé.</span>
      </div>
      {buttonHint && (
        <p role="status" className="text-sm font-bold text-ink/70">
          Chưa có khối “Khi nhấn nút A” nào. Con hãy ghép khối đó ở tab “Lập trình khối”, hoặc bấm “Chạy chương trình” bên dưới để xem chương trình mẫu.
        </p>
      )}
      <ProgramBar program={program} label="Chạy chương trình xe ủi" />
    </div>
  );
}
