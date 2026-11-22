# Project Context: SnapLab - Interactive STEAM Platform (Web + Hardware Kit)

## 1. Primary Commands

Always run verification checks after generating or refactoring significant features:

* **Typecheck:** `npm run typecheck` (or `npx tsc --noEmit`)

* **Lint:** `npm run lint`

* **Development Server:** `npm run dev`

* **Production Build Check:** `npm run build`

## 2. Product & Target Audience Context

* **Project Name:** SnapLab

* **Target Users:** Vietnamese K-12 students (ages 7–14) learning STEAM concepts via interactive web modules and hands-on physical kits (BBC micro:bit V1/V2, ESP32-C3/S3, PH2.0 sensors, and LEGO Technic compatible structures).

* **Language Policy:**

  * **User Interface (UI/UX), Tutor Feedback & Instructions:** 100% natural, encouraging, age-appropriate **Vietnamese**.

  * **Codebase, Variable Names, Comments & Commit Messages:** Strictly **English**.

## 3. Tech Stack Restrictions

Do NOT introduce unapproved UI, animation, or state-management libraries. Adhere to:

* **Framework:** Next.js 15+ (App Router), React 19, TypeScript (Strict Mode).

* **Styling & Components:** Tailwind CSS, Shadcn UI, Lucide Icons.

* **UI Animations:** `motion/react` (Framer Motion) for micro-interactions, `@formkit/auto-animate` for dynamic lists/Blockly queues, `canvas-confetti` for rewards.

* **2D Simulations:** `matter-js` (physics engines for levers, gears, distance sensors).

* **3D LEGO Assembly:** `@react-three/fiber` + `@react-three/drei` + `three` (interactive 3D step-by-step guides).

* **Hardware Communication APIs:** Native **WebUSB API**, **WebSerial API**, and **WebBluetooth API** (Direct browser communication with BBC micro:bit V1/V2 & ESP32 via Chrome/Edge, zero software installation).

* **Visual Programming:** Google `blockly` (for block-to-MicroPython/C++ compilation).

## 4. UI/UX & Socratic Pedagogy Rules

* **Micro-Interactive Learning (Brilliant.org Style):** Limit written text to 1–2 short explanatory sentences per screen. Pair every step with a tactile interactive widget, 2D physics canvas, or 3D assembly viewer.

* **Visual Theme:** Bright, high-contrast, playful palette with soft rounded corners (`rounded-2xl`). Avoid dark-mode corporate dashboards or default purple gradients.

* **Socratic AI Tutor Policy:** When a student submits an incorrect answer or wire configuration, **NEVER give the direct answer**. Always respond with a concise, encouraging guiding question to prompt self-correction.

## 5. Hardware Protocols (ESP32 & BBC micro:bit)

* **Browser Feature & Permission Detection:**

  * Always verify `navigator.serial`, `navigator.usb`, or `navigator.bluetooth` availability before initiating hardware sessions.

  * Provide friendly, visual fallback modal UI in Vietnamese for unsupported browsers (Safari/Firefox/iOS).

* **BBC micro:bit Communication Standards:**

  * **WebUSB / DAPLink Flashing:** Use WebUSB to flash compiled `.hex` files directly to micro:bit V1/V2 without requiring file drag-and-drop.

  * **WebUSB / WebSerial REPL & Telemetry:**

    * micro:bit V2 Serial Baud Rate: `115200` baud.

    * micro:bit V1 Serial Baud Rate: `9600` baud.

  * **WebBluetooth Services:** Support micro:bit Bluetooth GATT services (Accelerometer, Magnetometer, Button, LED Matrix, UART Service).

* **ESP32 Communication Standards:**

  * WebSerial baud rate: `115200` baud (JSON packets or MicroPython REPL stream).

* **Data Frame Conventions:**

  * Standardize all sensor telemetry into lightweight JSON frames (e.g., `{"device":"microbit","buttonA":1,"accel":[0.02,-0.98,0.1]}` or `{"device":"esp32","ultrasonic_cm":24.5}`).

* **Resource Safety & Connection Lifecycle:**

  * Implement auto-reconnect and heartbeats for unexpected USB disconnections.

  * Always close reader/writer streams and release USB/Serial claims inside the React `useEffect` cleanup phase.

## 6. Code Style & Performance Rules

* **Physics & Render Loops:** Keep `matter-js` engine loops and Three.js animation frames decoupled from React state renders. Use `useRef` to store simulation instances to maintain 60 FPS on lower-end devices.

* **Component Granularity:** Place reusable base UI elements in `src/components/ui`, interactive widgets in `src/components/interactive`, hardware monitors in `src/components/hardware`, and simulation canvases in `src/components/simulations`.