"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Classic LEGO Technic palette.
const C = {
  gray: "#a0a5a9",
  black: "#1b2a34",
  red: "#c91a09",
  yellow: "#f2cd37",
  blue: "#0055bf",
  white: "#f4f4f4",
  silver: "#d0d4d8",
};

const STUD = 0.8;

const STEPS = [
  { title: "Bước 1: Dựng khung", text: "Ghép các thanh Technic thành khung vững chắc nhé!" },
  { title: "Bước 2: Gắn cảm biến siêu âm", text: "Hai “mắt” của cảm biến phải nhìn về phía xe đang tới." },
  { title: "Bước 3: Gắn servo SG90", text: "Servo sẽ xoay cánh tay barie lên xuống." },
  { title: "Bước 4: Nối dây", text: "Nối mạch ESP32 với cảm biến và servo bằng dây màu." },
] as const;

function Beam({ holes, position, rotation = [0, 0, 0], color = C.gray }: {
  holes: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  const length = holes * STUD;
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[length, STUD, STUD]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {Array.from({ length: holes }, (_, i) => (
        <mesh key={i} position={[-length / 2 + STUD / 2 + i * STUD, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.24, STUD + 0.02, 16]} />
          <meshStandardMaterial color={C.black} />
        </mesh>
      ))}
    </group>
  );
}

function Pin({ position, color = C.red }: { position: [number, number, number]; color?: string }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.2, 0.2, STUD + 0.35, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Pops a build step into place (drop + scale), and hides it before its step. */
function StepGroup({ step, current, children }: { step: number; current: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const shown = step <= current;
    const k = 1 - Math.exp(-delta * 9);
    const targetScale = shown ? 1 : 0.001;
    const s = g.scale.x + (targetScale - g.scale.x) * k;
    g.scale.setScalar(s);
    const targetY = shown ? 0 : 2.5;
    g.position.y += (targetY - g.position.y) * k;
    g.visible = s > 0.01;
  });
  return <group ref={ref} scale={0.001}>{children}</group>;
}

function Wire({ points, color }: { points: [number, number, number][]; color: string }) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return (
    <mesh>
      <tubeGeometry args={[curve, 24, 0.06, 8, false]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Model({ current }: { current: number }) {
  return (
    <group position={[0, 0.4, 0]}>
      {/* Step 1: Technic frame */}
      <StepGroup step={1} current={current}>
        <Beam holes={9} position={[0, 0, -1.4]} />
        <Beam holes={9} position={[0, 0, 1.4]} />
        {[-2.8, 0, 2.8].map((x) => (
          <Beam key={x} holes={5} position={[x, STUD, 0]} rotation={[0, Math.PI / 2, 0]} color={C.black} />
        ))}
        {[-2.8, 2.8].flatMap((x) => [-1.4, 1.4].map((z) => <Pin key={`${x}${z}`} position={[x, 0.4, z]} />))}
      </StepGroup>

      {/* Step 2: ultrasonic sensor on two upright red beams */}
      <StepGroup step={2} current={current}>
        <Beam holes={4} position={[3.5, 2.2, -1.4]} rotation={[0, 0, Math.PI / 2]} color={C.red} />
        <Beam holes={4} position={[3.5, 2.2, 1.4]} rotation={[0, 0, Math.PI / 2]} color={C.red} />
        <mesh position={[3.95, 3.1, 0]} castShadow>
          <boxGeometry args={[0.25, 1.3, 3.4]} />
          <meshStandardMaterial color={C.blue} />
        </mesh>
        {[-0.9, 0.9].map((z) => (
          <mesh key={z} position={[4.25, 3.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 0.45, 24]} />
            <meshStandardMaterial color={C.silver} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </StepGroup>

      {/* Step 3: servo SG90 + barrier arm */}
      <StepGroup step={3} current={current}>
        <mesh position={[-1.2, 1.6, 0]} castShadow>
          <boxGeometry args={[2.3, 1.2, 1.1]} />
          <meshStandardMaterial color={C.blue} />
        </mesh>
        <mesh position={[-1.2, 2.35, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.4, 16]} />
          <meshStandardMaterial color={C.white} />
        </mesh>
        <Beam holes={6} position={[-1.2, 2.75, 0]} rotation={[0, Math.PI / 6, 0]} color={C.yellow} />
      </StepGroup>

      {/* Step 4: ESP32 board and wires */}
      <StepGroup step={4} current={current}>
        <mesh position={[-3.2, 1.55, 0]} castShadow>
          <boxGeometry args={[1.4, 0.2, 2.4]} />
          <meshStandardMaterial color={C.black} />
        </mesh>
        <mesh position={[-3.2, 1.75, 0.6]}>
          <boxGeometry args={[0.8, 0.2, 0.8]} />
          <meshStandardMaterial color={C.silver} metalness={0.7} roughness={0.3} />
        </mesh>
        <Wire color={C.red} points={[[-3, 1.7, -0.5], [-1.5, 3.4, -1.2], [1.5, 3.8, -1.1], [3.8, 3.4, -0.7]]} />
        <Wire color={C.yellow} points={[[-3, 1.7, 0], [-2, 2.6, 0.2], [-1.4, 2.2, 0.55]]} />
        <Wire color={C.gray} points={[[-3, 1.7, 0.5], [-1.5, 3.2, 1.2], [1.5, 3.6, 1.1], [3.8, 3.2, 0.7]]} />
      </StepGroup>
    </group>
  );
}

export function LegoViewer3D({ initialStep = 1, onStepChange }: { initialStep?: number; onStepChange?: (step: number) => void }) {
  const [step, setStepState] = useState(Math.min(4, Math.max(1, initialStep)));
  const setStep = (update: number | ((s: number) => number)) => {
    const next = typeof update === "function" ? update(step) : update;
    setStepState(next);
    onStepChange?.(next);
  };
  const info = STEPS[step - 1];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-2xl bg-gradient-to-b from-sky/20 to-cream">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [11, 7, 13], fov: 40 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow />
          {/* Local sky/ground light instead of drei's <Environment preset>, which downloads an HDR from a CDN that the CSP blocks. */}
          <hemisphereLight args={["white", "tan", 0.9]} />
          <Model current={step} />
          <ContactShadows position={[0, -0.01, 0]} opacity={0.35} scale={14} blur={2.5} far={4} />
          <OrbitControls enablePan={false} enableDamping minDistance={7} maxDistance={24} maxPolarAngle={Math.PI / 2 - 0.05} />
        </Canvas>
        <p className="pointer-events-none absolute bottom-2 left-3 text-xs font-bold text-ink/60">
          Kéo để xoay 360° · Cuộn để phóng to
        </p>
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="rounded-2xl bg-sun/20 p-3"
        aria-live="polite"
      >
        <p className="font-extrabold">{info.title}</p>
        <p className="text-sm text-ink/80">{info.text}</p>
      </motion.div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} aria-label="Bước trước">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-1 justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              aria-label={`Bước ${i + 1}`}
              aria-current={step === i + 1}
              className={cn(
                "h-10 w-10 cursor-pointer rounded-2xl text-sm font-extrabold transition-colors",
                step === i + 1 ? "bg-sky text-white" : i + 1 < step ? "bg-mint/40" : "bg-ink/5 hover:bg-ink/10",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <Button size="icon" onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={step === 4} aria-label="Bước tiếp theo">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
