---
name: ui-polish
description: Làm đẹp và thống nhất giao diện SnapLab theo hệ thống thiết kế trong docs/design/ui-revamp.md — bố cục trang bài học, viewport mô phỏng, HUD, điều khiển, sa bàn 2D, cảnh 3D. Dùng khi sửa UI, tạo component giao diện, làm lại một LessonXXSim, hoặc khi người dùng nói giao diện "chưa đẹp", "rối", "chưa giống mẫu".
---

# UI polish cho SnapLab

Nguồn sự thật: `docs/design/ui-revamp.md` (tokens §2, component §3, bố cục §4, hình mô phỏng §5).
Kết hợp skill `frontend-design` cho phần thẩm mỹ chung, nhưng **token và quy tắc ở đây được ưu tiên**.

## Trước khi sửa
1. Chụp ảnh "trước" của trang liên quan (xem *Kiểm tra bằng ảnh*).
2. Đọc component hiện có trong `src/components/ui/` — dùng lại, không tạo bản thứ hai.

## Quy tắc bắt buộc
- Chỉ dùng token (`bg-surface`, `text-ink`, `border-line`, `bg-sun`…). **Không** viết mã hex hay
  `bg-[#...]` trong component. Thiếu màu → thêm token vào `globals.css`, ghi vào ui-revamp §2.
- Panel mặc định là `Surface` (trắng). Nền pastel chỉ khi biểu thị trạng thái, và chỉ ở chip/viền nhỏ.
- Mỗi màn hình **một** nút CTA vàng (`bg-sun`). Nút chính khác dùng navy, phụ dùng viền.
- Nhãn nhóm bằng `SectionLabel`; số liệu bằng `StatTile` (số `font-display tabular-nums`, đơn vị nhỏ).
- Ô bấm ≥ 44–48 px; khoảng cách theo bội 4 (gap-2/3/4/6); bo `--radius-card` cho thẻ, `--radius-control` cho nút.
- Điều khiển trong sim nổi trên viewport qua `ViewportChrome` slots, không xếp hộp dưới canvas.
- Chữ UI tiếng Việt, ≤ 2 câu mỗi khối hướng dẫn; code/comment tiếng Anh.
- Không thêm thư viện UI/animation mới (theo CLAUDE.md); dùng `motion/react`, Tailwind, shadcn, lucide.
- Sim: không setState mỗi frame; HUD cập nhật bằng ref hoặc throttle ~10 Hz.

## Kiểm tra bằng ảnh
- Dev server: `npm run dev` (http://localhost:3000).
- Chụp: `node scripts/shot-lessons.mjs [ids...]` → `shots/<id>-<w>.png` ở 1280×800 và 1024×768,
  cho tab sim và tab đang sửa. Nếu script chưa có, tạo bằng Playwright (devDependency — hỏi người dùng trước khi cài).
- Đọc ảnh bằng Read tool và chấm theo checklist dưới; sửa, chụp lại, tối đa 3 vòng.

## Checklist chấm
1. Viewport mô phỏng chiếm ≥ 60% chiều cao cột trái, không có thanh cuộn trong cột trái ở 1280×800.
2. Nhìn vào màn hình 2 giây: biết ngay đâu là sim, đâu là việc cần làm, đâu là nút chính.
3. ≤ 3 màu nền khác nhau trong một khung nhìn (không tính trạng thái).
4. Số liệu quan trọng đọc được từ 1 m (số ≥ 28 px).
5. Không còn chữ kỹ thuật (baud, JSON) trên màn hình chính của học sinh.
6. Sa bàn 2D có lưới, bóng, xe ≥ 56 px, nón siêu âm; 3D có nền trùng trang, lưới mờ, bóng mềm.
7. 1024×768 không vỡ bố cục; tiếng Việt có dấu không bị cắt dòng xấu.
8. `npm run typecheck && npm run lint` sạch.
