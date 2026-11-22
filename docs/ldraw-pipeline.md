# LDraw trong SnapLab — kế hoạch áp dụng

Áp dụng cho repo ở commit `d1cc645` (UI revamp U1–U2). Đánh giá chung: tài liệu "Đánh giá phương án LDraw cho
SnapLab". Tài liệu này nói **sửa file nào, theo thứ tự nào**.

## 0. Hiện trạng liên quan

| Chỗ | Hiện tại | Sau khi áp dụng |
|---|---|---|
| `src/lib/lesson-steps.ts` → `hasLegoModel()` | cứng `lesson.id === "lesson-05"` | `Boolean(lesson.assembly)` |
| `src/components/shell/lesson-stage.tsx` | bước `lego3d` → `LegoViewer3D` (bài 5) hoặc `ComingSoon` | bài có `assembly` → `BrickAssembly`; bài 5 giữ `LegoViewer3D` tới khi có mô hình LDraw |
| `src/components/simulations/LegoViewer3D.tsx` | khung barie dựng tay, 4 bước | giữ làm fallback; sau đó xoá |
| `curriculum.ts` | 15 bài `requiresLegoAssembly: true` + `legoStepCount` | thêm `assembly?: { model, steps }`; `legoStepCount` phải khớp `steps.json` (test) |
| `next.config.ts` CSP | `connect-src 'self'` | **giữ nguyên**: mô hình tự host trong `public/models/`, không tải chi tiết từ GitHub/CDN |
| Chữ "LEGO" trong UI | `Lắp ráp LEGO 3D`, `LEGO · n bước`, tên cấp độ có "LEGO" | "khối lắp ghép" / "Lắp ráp 3D" (thương hiệu — xem tài liệu đánh giá) |

Đơn vị: 3D của SnapLab tính bằng **cm** (`LegoViewer3D`: `STUD = 0.8`). LDraw: 1 LDU = 0,4 mm = **0,04 cm**,
trục **−Y hướng lên** → khi nạp: `scale = 0.04`, xoay `Math.PI` quanh trục X.

## 1. Cấu trúc thư mục mới

```
assets-src/ldraw/                 # file nguồn do người thiết kế xuất từ Studio/LeoCAD (commit)
  lesson-05.mpd
vendor/ldraw/                     # thư viện chi tiết LDraw chính thức (+ unofficial/) — KHÔNG commit (.gitignore)
scripts/ldraw/
  pack-ldraw.mjs                  # đóng gói .mpd + sinh steps.json (có sẵn trong kit, đã test)
  pack-ldraw.test.mjs
  pack-all.mjs                    # chạy pack cho mọi file trong assets-src/ldraw (tạo ở L1)
public/models/
  lesson-05.mpd                   # sinh ra — commit (để Docker build không cần vendor/ldraw)
  lesson-05.steps.json
public/licenses/ldraw-CAreadme.txt
src/components/three/
  StageCanvas.tsx                 # nền, lưới, đèn, bóng dùng chung (U5 của ui-revamp)
  brick/BrickAssembly.tsx         # nạp .mpd, ẩn/hiện theo bước, gắn linh kiện điện tử
  brick/useLDrawModel.ts          # LDrawLoader + cache + dispose
  electronics/                    # MicrobitModel, Esp32Model, ServoSG90, SonarHCSR04P (dựng bằng code)
    registry.ts                   # tên anchor → component
src/app/giay-phep/page.tsx        # trang Giấy phép & ghi công
```
`.gitignore` thêm `vendor/ldraw/`. `vitest.config.mts` → `include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"]`.
`package.json` → `"models:pack": "node scripts/ldraw/pack-all.mjs"`.

## 2. Quy ước khi lắp mô hình (người thiết kế)

1. Lắp trong **BrickLink Studio** hoặc **LeoCAD**, chỉ dùng chi tiết có trong bộ kit SnapLab.
2. Chia bước (Studio: Instruction mode → *Divide into steps*, rồi chỉnh tay). Số bước = `legoStepCount` của bài.
3. Mỗi linh kiện điện tử = một **submodel rỗng** tên `ANCHOR_<tên>.ldr`, đặt đúng chỗ và hướng gắn thật, trong
   bước lắp linh kiện đó. Tên chuẩn: `ANCHOR_microbit`, `ANCHOR_esp32`, `ANCHOR_servo1`, `ANCHOR_servo2`,
   `ANCHOR_sonar`, `ANCHOR_motorA`, `ANCHOR_motorB`, `ANCHOR_board` (mạch mở rộng PH2.0).
4. Lời hướng dẫn mỗi bước: thêm dòng `0 !SNAPLAB STEP "Gắn servo vào khung"` (tiếng Việt, ≤ 1 câu) — trong Studio
   dùng chức năng thêm dòng chú thích, hoặc mở `.mpd` bằng trình soạn thảo chữ và chèn tay sau khi xuất.
5. Xuất **LDraw (.mpd)** → `assets-src/ldraw/lesson-XX.mpd`.

## 3. Vòng chạy

```
assets-src/ldraw/lesson-05.mpd ──pack-ldraw──▶ public/models/lesson-05.mpd + lesson-05.steps.json
                                                   │
LessonConfig.assembly ──▶ lesson-stage (bước "Lắp 3D") ──▶ BrickAssembly
                                                   ├─ LDrawLoader (packed, conditional lines)
                                                   ├─ part.visible = buildingStep ≤ bước hiện tại; phần mới rơi vào chỗ
                                                   └─ steps.json.anchors ──▶ electronics/registry ──▶ model linh kiện
```

### BrickAssembly — yêu cầu
- Nạp bằng `LDrawLoader` (`three/examples/jsm/loaders/LDrawLoader.js`) với
  `setConditionalLineMaterial(LDrawConditionalLineMaterial)`; file đã đóng gói nên **không** gọi `setPartsLibraryPath`.
- Ẩn/hiện theo bước: làm như ví dụ `webgl_loader_ldraw` của three.js (đọc số bước trên `userData` của từng chi tiết —
  **kiểm tra tên trường trong `node_modules/three/examples/jsm/loaders/LDrawLoader.js` của bản đang cài**).
- Bước hiện tại do StepRail/panel phải điều khiển; gọi `onLegoStep(step)` như `LegoViewer3D` để
  `legoStepReached` và trạng thái ✓ hoạt động y như cũ.
- Hiệu ứng: chi tiết của bước mới rơi từ +3 cm xuống, 300 ms (tái dùng ý tưởng `StepGroup`).
- Gộp hình: sau khi nạp, gộp **theo từng bước** bằng `LDrawUtils.mergeObject` (gộp cả mô hình sẽ mất ẩn/hiện).
- Linh kiện điện tử: với mỗi anchor trong `steps.json`, đặt component từ `registry.ts` tại `positionLdu × 0.04`
  (đổi trục như trên), quay theo ma trận `rotation`; hiện từ bước chứa anchor đó.
- Panel phải (bước Lắp 3D): `textVi` và danh sách `parts` (mã chi tiết + số lượng) của bước hiện tại.
- Đặt trong `StageCanvas` chung; `dpr={[1, 1.75]}`; `frameloop="demand"` khi đứng yên; dispose geometry/material
  khi rời bước.

## 4. Giai đoạn (mỗi giai đoạn = 1 phiên Claude Code + 1 commit)

| GĐ | Việc | Xong khi |
|---|---|---|
| L0 | Chuẩn bị: `.gitignore` `vendor/ldraw/`; trang `/giay-phep` (ghi công LDraw Parts Library CC BY 2.0/4.0 + link CAreadme); đổi chữ "LEGO" trong UI và tên cấp độ; thêm `assembly?` vào `LessonConfig`; `hasLegoModel()` đọc `assembly` (bài 5 vẫn dùng `LegoViewer3D` qua cờ riêng) | typecheck/lint/test sạch; test `lesson-steps` cập nhật |
| L1 | Chép `scripts/ldraw/*` từ kit; viết `pack-all.mjs`; `npm run models:pack`; vitest chạy `scripts/**/*.test.mjs`; test kiểm tra mỗi bài có `assembly` thì file tồn tại và `stepCount === legoStepCount` | `npm test` xanh |
| L2 | **Làm thử bài 5**: người thiết kế xuất `assets-src/ldraw/lesson-05.mpd`; `BrickAssembly` + `useLDrawModel`; bật qua `?viewer=ldraw` để so với `LegoViewer3D` | Đi hết các bước, ✓ đúng; đo tải + fps trên máy yếu (mục 5) |
| L3 | `electronics/*` + `registry.ts`; gắn theo anchor; panel phải hiện `textVi` + danh sách chi tiết | Linh kiện nằm đúng chỗ, đúng bước |
| L4 | Tối ưu nếu L2 chậm: chuyển `.mpd` → `.glb` lúc build (mpd2glb + gltf-transform), mỗi bước một node `step-NN`; `BrickAssembly` nạp GLB bằng `useGLTF` | Đạt ngưỡng mục 5 |
| L5 | Bỏ `LegoViewer3D`; nhân rộng cho 14 bài còn lại; cập nhật `lesson-factory` (bài mới phải có `.mpd` hoặc để bước Lắp 3D ở trạng thái "Sắp có") | Mỗi bài có mô hình |

## 5. Ngưỡng hiệu năng (đo ở L2, máy mục tiêu: laptop trường, Chrome, 1366×768)
- Tải mô hình (đã gzip qua Caddy) < 1,5 MB; thời gian từ mở bước đến thấy mô hình < 2 s.
- ≥ 45 fps khi xoay; draw call < 150 (xem `renderer.info.render.calls`).
- Không đạt → làm L4 trước khi nhân rộng.

## 6. Prompt cho Claude Code
1. "Đọc docs/ldraw-pipeline.md. Làm L0 và L1. Không cài thư viện mới. Chạy typecheck, lint, test rồi dừng."
2. (Sau khi có `assets-src/ldraw/lesson-05.mpd` và `vendor/ldraw/`) "Chạy `npm run models:pack`, làm L2 theo §3,
   dùng skill brick-model và ui-polish, chụp bước Lắp 3D bài 5 ở cả LegoViewer3D và ?viewer=ldraw, đo §5."
3. "Làm L3." · "Nếu §5 chưa đạt, làm L4."
