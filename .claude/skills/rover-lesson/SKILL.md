---
name: rover-lesson
description: Tạo hoặc sửa bài học xe robot dùng Rover Arena của SnapLab (simulationType 'rover-arena') — arena preset, vị trí xuất phát, chương trình Blockly mẫu, điều kiện thắng từ telemetry rover, gợi ý Socratic. Dùng khi thêm bài tránh vật cản, mê cung, đỗ xe, dò khoảng cách bằng servo, hoặc khi chuyển một LessonXXSim cũ về Rover Arena.
---

# Bài học xe robot trên Rover Arena

Đọc trước: `docs/rover-arena-plan.md` (§2 kiến trúc, §2.2 tích hợp lesson engine), `CLAUDE.md`.
**Không** tạo file `LessonXXSim.tsx` mới cho bài rover — bài rover là **dữ liệu**.

## Quy trình
1. **Arena**: chọn preset trong `src/lib/rover/arenas.ts` hoặc thêm preset mới (đơn vị cm, gốc góc trái dưới,
   vật cản `box` hoặc `circle`, `goals` là vùng chữ nhật). Viết test: xe xuất phát không chồng vật cản,
   tồn tại đường đi tới goal rộng ≥ 1.5 × bề ngang xe.
2. **LessonConfig** trong `src/lib/lessons-data/curriculum.ts`:
   - `simulationType: 'rover-arena'`, `rover: { arena, start, showSonarBeam, sensorOnServo }`.
   - `hardwarePorts`: siêu âm `PH2.0-x`, `SERVO-1` (nếu quét), `MOTOR-A` (trái), `MOTOR-B` (phải) —
     điền `pinInfo` cho cả `esp32` và `microbit`.
   - `defaultBlocklyBlocks`: chỉ khối đã có trong `src/lib/blockly/blocks.ts`. Cần khối mới → thêm vào
     **cả** `blocks.ts`, `interpreter.ts`, `python.ts` và hằng số dùng chung `constants.ts`.
3. **Điều kiện thắng**: phải chấm được **cả** ở sim lẫn xe thật.
   - Sim có `rover_x/rover_y/collisions/rover_goal_reached`; xe thật chỉ có `ultrasonic_cm`, `drive`,
     `servo_deg`, `event`. Ưu tiên `sequence_complete` trên `event` tokens
     (`OBSTACLE_AVOIDED`, `GOAL_REACHED`, `COLLISION`, `STUCK`) hoặc `sensor_threshold` + `holdDurationMs`.
   - Nếu điều kiện chỉ đo được ở sim, ghi rõ trong `descriptionVi` và đặt evaluator `measurable=false`
     khi đang ở chế độ phần cứng.
4. **Chương trình mẫu (demo)**: dựng bằng `blocks as B` + `demoProgram(...)` như Lesson19Sim; demo phải
   **thắng** arena trong < 60 s mô phỏng — viết test chạy interpreter + `src/lib/rover` headless để xác nhận.
5. **Lỗi thường gặp + gợi ý**: ít nhất 3 `commonMistakes`, mỗi `hintVi` là **một câu hỏi gợi mở** tiếng Việt,
   ≤ 2 câu, không đưa đáp án (vd. "Con thử xem xe đã kịp dừng trước khi khoảng cách nhỏ hơn 15 cm chưa?").
   `conditionCode` phải ứng với token/metric mà sim thật sự phát ra.
6. **Kiểm tra**: `npm run typecheck && npm run lint && npm test`; mở `/lessons/<id>`, chạy demo, chạy chương
   trình sai cố ý để thấy gợi ý; ghi một dòng vào `docs/brainstorm_log.md`.

## Ràng buộc
- UI và gợi ý: tiếng Việt tự nhiên cho học sinh 7–14 tuổi; code/comment/commit: tiếng Anh.
- Không setState trong vòng lặp mô phỏng; mọi pose xe/servo đi qua ref.
- MOTOR-A = bánh trái, MOTOR-B = bánh phải — khớp `DRIVE_WHEELS` của interpreter.
