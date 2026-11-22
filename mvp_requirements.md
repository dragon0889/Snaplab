# Product Requirement Document (PRD): SnapLab STEAM Platform MVP

## 1. Executive Summary & Objective

* **Project Name:** SnapLab (Interactive STEAM Platform)

* **Objective:** Develop a Minimum Viable Product (MVP) to validate student engagement with interactive web lessons, real-time WebSerial/WebUSB hardware telemetry (ESP32 / micro:bit), 2D physics simulations, 3D assembly guides, and a Socratic AI Tutor.

* **Success Criteria:**

  1. A student can complete "Lesson 1: Smart Ultrasonic Barrier" from start to finish on Chrome/Edge.

  2. The browser successfully communicates bidirectionally with an ESP32 or micro:bit without native app installation.

  3. The Socratic AI Tutor responds appropriately in Vietnamese without giving direct solutions.

## 2. Core MVP Features & Scope

### Feature 1: Hardware Connection Bar & Telemetry Monitor

* **Goal:** Connect browser directly to ESP32 / micro:bit over WebSerial/WebUSB.

* **Key Requirements:**

  * Browser capability check (detect Chrome/Edge vs. unsupported browsers).

  * Connect/Disconnect toggle button with visual status indicators (Connected / Disconnected / Error).

  * Baud rate selector (115200 for ESP32 & micro:bit V2, 9600 for micro:bit V1).

  * Live Telemetry Panel: Displays real-time JSON or raw stream inputs (e.g., Ultrasonic distance `cm`, Button state `A/B`, Light sensor values).

  * WebUSB DAPLink flasher interface for micro:bit `.hex` drag-and-drop replacement.

### Feature 2: Split-Screen Interactive Lesson Engine

* **Goal:** Provide a high-engagement, micro-learning interface inspired by Brilliant.org.

* **Layout (Responsive Desktop-First):**

  * **Left Panel (Interactive Workspace):** Switchable tabs between:

    1. **2D Physics/Sensor Canvas:** Powered by `matter-js` (e.g., car approaching a barrier, distance visualization).

    2. **3D LEGO Assembly View:** Powered by `@react-three/fiber` (3D step-by-step model rotation/zoom).

    3. **Blockly Code Canvas:** Google Blockly workspace compiling blocks to MicroPython/Arduino C++.

  * **Right Panel (Instruction & AI Tutor):**

    * Step-by-step instruction slides in Vietnamese (short text + tactile widgets).

    * Interactive Quiz/Slider check.

    * Socratic AI Tutor Chat Box with predefined hint triggers.

### Feature 3: Sample MVP Course Content ("Module 1: Smart Barrier")

* **Step 1 (Theory & 2D Simulation):** Adjust distance slider in `matter-js` canvas to understand ultrasonic sensor range logic.

* **Step 2 (3D Hardware Assembly):** View 3D model steps to attach Servo SG90 and Ultrasonic sensor to LEGO Technic frame.

* **Step 3 (Blockly Logic):** Drag-and-drop logic: `If Ultrasonic < 10cm -> Rotate Servo 90deg -> Play Buzzer Beep`.

* **Step 4 (Hardware Execution & Validation):** Stream code to ESP32/micro:bit and verify hardware physical execution against web goals.

### Feature 4: Socratic AI Tutor System (SnapLab Companion)

* **Role:** Friendly learning companion.

* **Rules:**

  * Input: Current step context + Student error logs (e.g., incorrect Blockly block arrangement, hardware disconnected).

  * Prompt Constraint: Must respond in Vietnamese, maximum 2 sentences, formatted as a guiding question (e.g., *"Con thử kiểm tra xem cảm biến siêu âm đã nhận khoảng cách dưới 10cm chưa?"*).

## 3. Technology Stack & Dependencies

```json
{
  "project_name": "SnapLab",
  "framework": "Next.js 15 (App Router, React 19, TypeScript)",
  "styling": "Tailwind CSS + Shadcn UI + Lucide Icons",
  "animations": "motion/react, @formkit/auto-animate, canvas-confetti",
  "simulations": "matter-js, three, @react-three/fiber, @react-three/drei",
  "visual_programming": "blockly",
  "hardware_apis": "WebSerial API, WebUSB API, WebBluetooth API"
}
```

## 4. Phase-by-Phase MVP Development Plan

### Milestone 1: Project Setup & SnapLab Shell

* Initialize Next.js 15, install Shadcn UI and core packages.

* Build responsive App Shell: Header with SnapLab Branding + Hardware Connection Bar, Split-Screen Layout, Tab switcher.

### Milestone 2: WebSerial & WebUSB Hardware Bridge

* Implement custom React hook `useHardwareConnection()`.

* Build WebSerial/WebUSB connection modal and telemetry debug drawer.

* Create hardware mock simulator (for testing in browser without plugging real hardware).

### Milestone 3: Simulation Canvases (2D & 3D)

* Build `MatterCanvas` component for 2D sensor & barrier physics.

* Build `LegoAssembly3D` component loading `.glb` 3D parts with step navigation.

### Milestone 4: Blockly Workspace & Generator

* Integrate Google `blockly` with custom themed SnapLab blocks.

* Implement MicroPython & C++ code generators for ESP32 and micro:bit.

### Milestone 5: Socratic AI Tutor & End-to-End Lesson 1

* Create API route `/api/ai-tutor` with system prompt guardrails.

* Wire up Lesson 1 state machine (Step 1 -> Step 4 completion with confetti celebration).

## 5. Verification Checklist for Claude Code

After completing each phase, Claude Code must verify:

1. `npm run typecheck` passes with 0 errors.

2. No hardware API calls executed without `typeof navigator !== 'undefined'` check.

3. All interactive UI components support smooth 60 FPS spring animations via `motion/react`.