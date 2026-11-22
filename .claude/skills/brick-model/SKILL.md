---
name: brick-model
description: Đưa mô hình khối lắp ghép LDraw (.mpd/.ldr xuất từ BrickLink Studio hoặc LeoCAD) vào bước "Lắp 3D" của một bài SnapLab — đóng gói bằng scripts/ldraw/pack-ldraw.mjs, sinh steps.json, gắn linh kiện điện tử theo ANCHOR_*, nối vào LessonConfig.assembly và BrickAssembly. Dùng khi thêm/sửa mô hình 3D lắp ráp, khi bước Lắp 3D đang "Sắp có", hoặc khi nhắc tới LDraw, .mpd, Studio, LeoCAD.
---

# Mô hình lắp ghép LDraw cho SnapLab

Nguồn sự thật: `docs/ldraw-pipeline.md` (quy ước §2, vòng chạy §3, ngưỡng hiệu năng §5).

## Quy trình cho một bài
1. Kiểm tra đầu vào: có `assets-src/ldraw/<lesson-id>.mpd` và `vendor/ldraw/` (thư viện chính thức, có
   `LDConfig.ldr`). Thiếu → dừng và nói rõ cần gì; **không** tự tải thư viện, **không** tải chi tiết lúc chạy.
2. `node scripts/ldraw/pack-ldraw.mjs assets-src/ldraw/<id>.mpd public/models --name <id>`
   - Lỗi "Missing … file(s)" → báo người dùng tên chi tiết thiếu (có thể cần thư mục `unofficial/` hoặc chi tiết
     tự tạo trong Studio phải được nhúng vào .mpd). Không bỏ qua chi tiết thiếu.
   - Cảnh báo "Steps without !SNAPLAB STEP text" → hỏi người dùng lời hướng dẫn, hoặc đề xuất câu ngắn tiếng Việt
     và ghi rõ là đề xuất.
3. Đối chiếu `public/models/<id>.steps.json`:
   - `stepCount` = `legoStepCount` trong `curriculum.ts` (khác → hỏi người dùng nên sửa bên nào).
   - Mỗi anchor có trong `src/components/three/electronics/registry.ts`; mỗi linh kiện trong `hardwarePorts` của
     bài (trừ `ONBOARD`, `WEBCAM`, `MIC`) có anchor tương ứng.
4. `curriculum.ts`: `assembly: { model: "/models/<id>.mpd", steps: "/models/<id>.steps.json" }`.
5. `npm run typecheck && npm run lint && npm test`; mở `/lessons/<id>?step=lego3d`, đi hết các bước, chụp ảnh
   (skill `ui-polish`) và kiểm tra: mô hình đứng đúng chiều (−Y của LDraw là hướng lên), tỉ lệ cm đúng
   (1 LDU = 0,04 cm), linh kiện điện tử nằm đúng chỗ, ✓ của bước Lắp 3D chỉ bật ở bước cuối.

## Ràng buộc
- Mô hình tự host trong `public/models/` (CSP `connect-src 'self'`). Không dùng URL thư viện ngoài.
- File đóng gói là bản phân phối lại thư viện LDraw (CC BY): trang `/giay-phep` phải còn dòng ghi công.
- Không dùng chữ "LEGO" trong chữ hiển thị cho học sinh; dùng "khối lắp ghép" / "Lắp ráp 3D".
- Không sửa tay `public/models/*` — sửa file nguồn trong `assets-src/ldraw/` rồi đóng gói lại.
- Claude Code không tự "lắp" mô hình phức tạp bằng cách viết .ldr; mô hình do người thiết kế làm trong Studio/LeoCAD.
  Ngoại lệ: chỉnh nhỏ có kiểm chứng (dời một anchor, thêm dòng `!SNAPLAB STEP`) — ghi rõ trong commit.
