# Rover Arena — kế hoạch tích hợp mô phỏng xe robot vào SnapLab

Mục tiêu: đưa cách làm mô phỏng kiểu RoverKit (một "thế giới" xe chạy tự do trong sa bàn, cảm biến
siêu âm quét bằng servo, xe ảo nhận đúng lệnh như xe thật) vào SnapLab **mà không phá kiến trúc hiện có**:
Next.js + R3F, Blockly interpreter, `useSimLoop`, `useSimTelemetry`, evaluator theo telemetry, AI tutor.

> Chỉ tham khảo hành vi của roverkit.vercel.app. Không sao chép code, chữ, hình ảnh của trang đó.

---

## 1. Khác biệt cốt lõi cần giữ

| | RoverKit | SnapLab + Rover Arena |
|---|---|---|
| Ai ra quyết định ở chế độ tự động | Firmware cố định (Auto) | **Chương trình Blockly của học sinh** |
| Flowchart "xe đang nghĩ gì" | Sơ đồ cố định | **Tô sáng khối Blockly đang chạy** |
| Thế giới mô phỏng | 1 sa bàn | Mỗi bài học một **arena preset** + điều kiện thắng |
| Mô hình 3D | Xe acrylic | Xe **LEGO Technic** — dùng chung cho tab lắp ráp và tab mô phỏng |
| Chấm điểm | Không | Evaluator đọc telemetry (`rover_*`, `event`) |

## 2. Kiến trúc

```
src/lib/rover/                 # THUẦN TypeScript, không React, không three — test được bằng Vitest
  types.ts                     # RoverWorld, Arena, Obstacle (box|circle), Goal, CarState, RoverTuning
  kinematics.ts                # stepCar(car, motorA%, motorB%, dt, tuning) — differential drive
  collide.ts                   # OBB xe vs AABB/circle/tường; trả về contact để chặn chuyển động
  sonar.ts                     # sonarCm(world, servoDeg) — 3 tia (−7.5°, 0, +7.5°), 2–400 cm, nhiễu ±0.2
  arenas.ts                    # preset theo bài: 'straight-wall', 'slalom', 'maze-s', 'parking'…
  telemetry.ts                 # frame(world, outputs) → SimTelemetry (cùng tên trường với firmware)
  events.ts                    # phát token: OBSTACLE_AVOIDED, COLLISION, GOAL_REACHED, STUCK
  tuning.ts                    # hằng số hiệu chỉnh theo bo (esp32 / microbit) — đo từ xe thật
  world.ts                     # createWorld / stepWorld / resetWorld: ghép kinematics + collide + events (mutable, để trong useRef)
  reachability.ts              # isGoalReachable(): kiểm tra mỗi arena có đường tới goal đủ rộng (dùng trong test)
  # Quy ước: cm, gốc ở góc TRÁI DƯỚI (+y lên), heading kiểu la bàn (0° = +y, 90° = +x, quay thuận chiều kim đồng hồ),
  # MOTOR-A = bánh trái, servo 90° = nhìn thẳng, 0° = nhìn phải, 180° = nhìn trái. SVG/canvas phải lật trục y khi vẽ.
src/components/three/lego/     # Beam, Pin, Axle, Wheel, Hub… tách ra từ LegoViewer3D để dùng chung
src/components/simulations/rover/
  RoverSim.tsx                 # container: vòng lặp + Blockly + telemetry + điều khiển
  RoverArena3D.tsx             # R3F: sàn, vật cản, xe, tia siêu âm, camera bám xe (dynamic import)
  RoverMinimap.tsx             # SVG từ trên xuống (nhẹ, chạy cả máy yếu); có thể là view chính trên mobile
  RoverCar3D.tsx               # xe LEGO + servo đầu cảm biến; nhận pose qua ref, không qua state
  RoverHud.tsx                 # khoảng cách, tốc độ, hướng, va chạm
```

### 2.1 Vòng dữ liệu (một tick 16 ms, nằm trong `useSimLoop`)
```
Blockly interpreter ──outputs.motor['MOTOR-A'/'MOTOR-B'], outputs.servo['SERVO-1']──▶ kinematics + collide
        ▲                                                                                   │
        └──── getInputs(): { distance: sonarCm(world, servo) , … } ◀────────────────────────┘
useSimTelemetry (100 ms) ──frame──▶ onTelemetry ──▶ evaluator (+ tutor context)
draw() (rAF) ──▶ cập nhật ref của RoverCar3D / RoverMinimap (KHÔNG setState mỗi frame)
```
- Dùng lại `useBlockProgram`, `useSimLoop`, `useSimTelemetry`, `ValueWatcher`, `ProgramBar` y như các sim hiện có.
- Gamepad: `program.hasGamepadHandler/fireGamepad` đã có — map phím WASD/mũi tên vào đây; nếu học sinh
  chưa có khối gamepad thì WASD lái trực tiếp (chế độ "lái thử").
- Ánh xạ motor phải khớp `DRIVE_WHEELS` của interpreter: MOTOR-A = trái, MOTOR-B = phải.

### 2.2 Tích hợp với lesson engine
- `SimulationType` thêm `'rover-arena'`; `SIM_LABEL` thêm "Mô phỏng xe robot".
- `LessonConfig` thêm trường tuỳ chọn:
  ```ts
  rover?: { arena: ArenaId; start: { x: number; y: number; headingDeg: number }; showSonarBeam?: boolean;
            sensorOnServo?: boolean /* đầu siêu âm gắn trên SERVO-1 */ };
  ```
- `lesson-tabs.tsx`: đăng ký `RoverSim` bằng `next/dynamic` (`ssr:false`) như `RobotArmSim`.
- Evaluator (`src/lib/evaluator/metrics.ts`): thêm metric
  `rover_goal_reached`, `rover_collisions`, `obstacles_avoided_count`, `rover_distance_travelled_cm`,
  `rover_time_s`; dùng `event` tokens cho điều kiện `sequence_complete`.
- Telemetry frame (giữ quy ước JSON trong CLAUDE.md):
  `{"device":"sim","ultrasonic_cm":24.5,"drive":"FORWARD","servo_deg":90,"motor_a":60,"motor_b":60,
    "rover_x":120.4,"rover_y":80.2,"heading_deg":35,"collisions":0,"event":"OBSTACLE_AVOIDED"}`
  Xe thật không biết `rover_x/y` → evaluator phải chấm được bài **chỉ từ các trường xe thật có**
  (`ultrasonic_cm`, `drive`, `event`) khi đang ở chế độ phần cứng.

### 2.3 "Xe đang nghĩ gì" (thay cho flowchart cố định)
- Interpreter báo id khối đang thực thi (callback `onBlock(id)` trong `ExecContext`, gọi trước mỗi lệnh).
- `BlocklyWorkspace` tô sáng khối đó (`workspace.highlightBlock(id)`), throttle ~10 Hz.
- Trên arena hiện bong bóng nhỏ trên đầu xe: "Thấy vật cản 12 cm → Dừng".

## 3. Xe thật

### 3.1 Hai chế độ
1. **Chạy trên xe** (đã có): Blockly → MicroPython nạp vào bo; telemetry về qua Serial/USB → evaluator.
2. **Lái trực tiếp** (mới, giống RoverKit): trình duyệt gửi lệnh `{"cmd":"drive","dir":"FORWARD"}`,
   `{"cmd":"servo","port":"SERVO-1","deg":90}`, xe gửi telemetry 10 Hz. Dead-man: dừng nếu 700 ms không có lệnh.

### 3.2 Không dây — đề xuất Bluetooth LE (Nordic UART Service) cho cả hai bo
- Xe chạy trên sàn thì không cắm cáp USB được. Web Bluetooth chạy được trên trang https của SnapLab
  (Caddy) — khác với WebSocket `ws://` tới ESP32 bị chặn mixed content.
- **ESP32-C3/S3** có BLE: firmware MicroPython dùng module `bluetooth` dựng NUS.
- **micro:bit**: MicroPython của micro:bit **không hỗ trợ Bluetooth** → hai lựa chọn:
  (a) nạp sẵn một file `.hex` "SnapLab Rover Link" viết bằng MakeCode (bật UART service) qua WebUSB flasher
      đã có — dùng cho chế độ "Lái trực tiếp";
  (b) micro:bit thứ hai cắm vào máy tính làm cầu nối `radio` ↔ USB serial (dùng `SerialTransport` sẵn có),
      cho phép cả chương trình MicroPython của học sinh gửi telemetry không dây.
- Thêm `src/lib/hardware/ble-transport.ts` implement `Transport` (open/reopen/close/write/isAlive);
  gom các mảnh notify 20 byte qua `createLineSplitter` đã có. `TransportKind` thêm `"ble"`.
- Lệnh BLE ≤ 20 byte/dòng: dùng dạng ngắn `D:F`, `S1:90`, `V:60` (chỉ ở transport BLE; lớp trên vẫn là object).

### 3.3 Digital twin
- Khi phần cứng đang kết nối, `RoverSim` có công tắc "Theo xe thật": HUD và đầu cảm biến 3D lấy
  `ultrasonic_cm`, `servo_deg`, `drive` từ telemetry thật; xe ảo chạy dead-reckoning theo `drive` + `tuning`
  (chỉ mang tính minh hoạ, ghi rõ trên UI).

## 4. Đồng bộ sim ↔ code nạp xuống xe
Hiện có **hai** cách hiểu cùng một khối: `interpreter.ts` (trong trình duyệt) và `python.ts` + thư viện runtime
trên bo. Rover làm lệch nhỏ thành lỗi lớn (xe ảo tránh được, xe thật đâm). Cần:
- Một bảng hằng số dùng chung `src/lib/blockly/constants.ts` (DRIVE_SPEED, chiều quay, mapping port) — cả
  interpreter lẫn phần sinh helper MicroPython đọc từ đây.
- Test (Vitest) "parity": với một tập chương trình mẫu, chạy interpreter trên một chuỗi input giả và so chuỗi
  output với bảng kỳ vọng được viết tay cho MicroPython (không chạy được MicroPython trong CI thì ít nhất
  khoá các hằng số và ánh xạ khối → hàm).
- `tuning.ts`: tốc độ cm/s ở 60 %, tốc độ quay °/s, cho từng bo — đo bằng bài "hiệu chỉnh" (cho xe chạy 2 s,
  học sinh đo quãng đường bằng thước, nhập vào).

## 5. Giai đoạn triển khai (mỗi giai đoạn = 1 phiên Claude Code + 1 commit)

| GĐ | Phạm vi | Xong khi |
|---|---|---|
| 0 | Dọn nền: `claude.md` → `CLAUDE.md`; đưa skill/agent về `.claude/skills`, `.claude/agents` (hoặc symlink từ `.agents/`); thêm Vitest (`npm test`) | Claude Code thấy skill/agent; `npm test` chạy |
| 1 | `src/lib/rover/*` + test: kinematics, collide, sonar, arenas, events | Test pass; không import React/three |
| 2 | `RoverMinimap` (SVG) + `RoverSim` nối `useBlockProgram`/`useSimLoop`/`useSimTelemetry`; WASD lái thử | Lái được trên minimap, telemetry hiện trong drawer |
| 3 | Tách `src/components/three/lego/*` từ `LegoViewer3D`; `RoverCar3D` + `RoverArena3D` (camera orbit/bám xe, tia siêu âm) | 60 fps; đổi tab không rò rỉ WebGL context |
| 4 | Lesson engine: `'rover-arena'`, trường `rover`, registry, metric evaluator, hint tutor theo `event` | Một bài mẫu chấm được đạt/chưa đạt |
| 5 | Tô sáng khối Blockly đang chạy + bong bóng "xe đang nghĩ" | Thấy rõ khối nào ra quyết định |
| 6 | Bài học: viết lại Lesson 19 trên engine mới; thêm 2–3 bài (tránh vật cản quét servo, đi mê cung, đỗ xe) qua `lesson-factory` | Mỗi bài có arena + win condition + common mistakes |
| 7 | Tab lắp ráp 3D dùng cùng model xe (bước lắp = trạng thái ẩn/hiện + tween của chính `RoverCar3D`) | Lắp xong ở tab 3D = xe chạy ở tab mô phỏng |
| 8 | `ble-transport.ts` + firmware "Rover Link" (ESP32 MicroPython BLE; micro:bit MakeCode .hex) + chế độ Lái trực tiếp | Lái xe thật từ bản https |
| 9 | Digital twin + `tuning.ts` theo bo + bài hiệu chỉnh | Xe ảo và xe thật đi quãng đường gần nhau (±15 %) |

## 6. Rủi ro & lưu ý
- **Hiệu năng máy trường học**: R3F nặng → minimap SVG là view mặc định trên máy yếu/mobile; 3D bật khi
  `navigator.hardwareConcurrency >= 4` hoặc người dùng chọn.
- **Nhiều WebGL context** (LegoViewer3D, RobotArmSim, Lesson13Sim, RoverArena3D): chỉ mount canvas của tab đang mở.
- **Mỗi bài một component 200–450 dòng** đang lặp code; Rover Arena nên là component cấu hình bằng dữ liệu
  (arena + win condition), bài mới không cần file `LessonXXSim.tsx` mới.
- **matter-js** không cần cho rover (top-down, kinematics tự viết đơn giản và tất định hơn, dễ chấm điểm).
