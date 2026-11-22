# SnapLab — Cải tiến giao diện (UI revamp)

Khảo sát 22/11/2026 trên bản local (bài 10, 11, 13, 19), so với trang tham chiếu roverkit.vercel.app.
Mục tiêu: **không sao chép** RoverKit, mà học cách nó tạo cảm giác "sản phẩm thật": một sân khấu mô phỏng
lớn, thứ bậc chữ rõ, bảng màu tiết chế, số liệu to, điều khiển gọn. Giữ tinh thần vui tươi cho học sinh 7–14 tuổi.

---

## 1. Chẩn đoán

| # | Vấn đề hiện tại | RoverKit làm thế nào | Mức |
|---|---|---|---|
| 1 | Khung mô phỏng nhỏ (~45% chiều cao cột trái), bên dưới là 4–5 hộp xếp chồng | Viewport chiếm toàn bộ cột, HUD/zoom/minimap/flowchart **nổi trên** viewport | Cao |
| 2 | Mỗi hộp một màu pastel (vàng, hồng, xanh, đỏ, mint) → rối, không biết nhìn đâu trước | Nền kem + bề mặt trắng + 1 màu chính (navy) + 1 màu nhấn (vàng) chỉ cho CTA/trạng thái active | Cao |
| 3 | Một font (Nunito) cho mọi thứ, cỡ chữ gần nhau; số liệu nhỏ ("Khoảng cách: 121.6 cm" ở góc canvas) | Font display condensed IN HOA cho tiêu đề, **số to + đơn vị nhỏ**, nhãn nhỏ in hoa giãn chữ, monospace cho log | Cao |
| 4 | Sa bàn 2D phẳng: tường là thanh xám, xe 30 px, tia siêu âm là đường chấm; không lưới, không bóng | Sàn lưới, bóng đổ mềm, vật cản có khối, xe chi tiết, nón siêu âm + điểm chạm | Cao |
| 5 | 3D (bài 13): tấm xám lơ lửng trên nền xanh nhạt, ánh sáng mặc định, vật thể nhỏ | Nền trùng màu trang, lưới mờ dần, camera ¾ cao, bóng mềm, vật thể lấp đầy khung | Trung |
| 6 | Cột phải: khung chat chiếm ~60% chiều cao nhưng gần như trống | Cột phải là "bước đang làm": số bước, tiêu đề, 1–2 câu, các nhóm điều khiển có tiêu đề nhỏ + đường kẻ mảnh | Cao |
| 7 | Điều khiển rời rạc: hàng nút tròn viền mỏng, "Lái thử:" + "Đặt lại xe" cùng hàng | D-pad hình chữ thập, segmented control cho chế độ, toggle, slider có giá trị bên phải | Trung |
| 8 | Header đặt cả baud rate, chế độ giả lập — thông tin kỹ thuật với học sinh nhỏ | Header chỉ có logo, chọn bo, ngôn ngữ, ⚙; chi tiết kỹ thuật nằm trong Cài đặt | Trung |
| 9 | Không thấy "hành trình" bài học; tab ngang thay cho các bước | Thanh bước có ảnh thu nhỏ ở đáy, nút Back/Next | Trung |
| 10 | Trộn phong cách: viền ink 2 px + bóng "nút kẹo" `shadow-[0_3px_0]` + thẻ phẳng `shadow-sm` | Một kiểu bề mặt duy nhất: bo 14–16 px, viền 1 px, bóng mềm | Thấp |
| 11 | Dữ liệu cảm biến ẩn trong drawer | "Serial monitor" nền tối luôn thấy trong bước Chạy thử — trẻ thấy máy "đang nghĩ" | Trung |

## 2. Hệ thống thiết kế mới (tokens — `src/app/globals.css`, Tailwind v4 `@theme`)

```css
@theme {
  /* Bề mặt */
  --color-canvas: #fbf6ea;      /* nền trang, ấm */
  --color-surface: #ffffff;     /* thẻ, panel */
  --color-sunken: #f3ecdb;      /* nền ô nhập, track slider, vùng lõm */
  --color-line: #e6dcc6;        /* viền 1px, đường kẻ nhóm */
  /* Chữ & màu chính */
  --color-ink: #1d2b4f;         /* chữ chính + nút chính (navy) */
  --color-ink-soft: #5b6785;    /* chữ phụ */
  --color-sun: #ffc83d;         /* NHẤN: CTA chính, trạng thái đang chọn — dùng tiết kiệm */
  /* Trạng thái (chỉ dùng cho ý nghĩa, không trang trí) */
  --color-go: #22c08a;  --color-stop: #ff5a5f;  --color-info: #3b9eff;
  /* Chữ */
  --font-display: "Baloo 2", "Nunito", system-ui, sans-serif;   /* tiêu đề, số to — có tiếng Việt */
  --font-sans: "Nunito", system-ui, sans-serif;                 /* nội dung */
  --font-mono: "JetBrains Mono", ui-monospace, monospace;       /* serial, số liệu kỹ thuật */
  /* Hình khối */
  --radius-card: 16px;  --radius-control: 12px;
  --shadow-card: 0 1px 0 rgb(29 43 79 / .04), 0 8px 24px -12px rgb(29 43 79 / .18);
  --shadow-float: 0 2px 0 rgb(29 43 79 / .06), 0 12px 32px -10px rgb(29 43 79 / .28);
}
```
Quy tắc màu: **80% trung tính (canvas/surface/ink), 15% navy, ≤ 5% vàng**. Pastel chỉ dùng làm nền nhẹ của
trạng thái (vd. chip "Va chạm" đỏ nhạt khi có va chạm), không làm màu nền mặc định của panel.
Font: tải bằng `next/font/google` với `subsets: ["vietnamese", "latin"]`.

Thang chữ: nhãn 11/700 IN HOA `tracking-[.12em]` · nội dung 15/500 · tiêu đề bước 28/800 display ·
số HUD 30/800 display `tabular-nums` + đơn vị 12/700.

## 3. Bộ component cần có (`src/components/ui/`)

| Component | Mô tả |
|---|---|
| `Surface` | thẻ trắng, `rounded-[--radius-card] border border-line shadow-card` — thay mọi hộp màu |
| `SectionLabel` | nhãn IN HOA nhỏ + đường kẻ mảnh kéo dài (`flex items-center gap-3 after:h-px after:flex-1 after:bg-line`) |
| `StatTile` | nhãn nhỏ + số to + đơn vị; biến thể `onDark` để nổi trên viewport (nền trắng 90% + blur) |
| `SegmentedControl` | dùng cho Chế độ (Tay/Tự động/Dừng), chọn bo; nền `sunken`, mục chọn nền navy chữ trắng, có `layoutId` motion |
| `DPad` | chữ thập 3×3, ô vuông navy bo 12, tâm là nút Dừng tròn; nhấn-giữ; phím WASD; ô ≥ 48 px |
| `Toggle`, `LabeledSlider` | slider có giá trị lớn bên phải, track `sunken`, thumb trắng viền navy |
| `ConsolePanel` | nền `ink`, chữ mono 12, timestamp mờ, giá trị màu theo loại; tự cuộn; nút Xoá |
| `ViewportChrome` | khung chứa sim: nhãn cảnh góc trên trái, cụm nút tròn trắng (zoom, camera, toàn màn hình) góc trên phải, slot HUD, slot minimap, slot overlay đáy |
| `StepRail` | thanh bước ở đáy cột trái: số + tên + trạng thái (xong/đang/chưa) |

## 4. Bố cục mới của trang bài học

```
┌ Header 64px: Logo · [Bài 11 · Xe tự hành tránh vật cản]        [● Chưa kết nối  Kết nối xe] [⚙] ┐
├──────────────────────────── 62% ─────────────────────┬──────────── 38% ───────────────────────┤
│ ViewportChrome (chiếm hết chiều cao còn lại)          │ ① BƯỚC 4/5 · CHẠY THỬ                   │
│  ┌StatTile×4 nổi┐                       [+][−][🎥][⛶] │ TÁCH KHỎI TƯỜNG                          │
│  │ 43.6cm 60% 0 né 0 va│                              │ 1–2 câu hướng dẫn                         │
│                (sa bàn / 3D)                          │ ─ ĐIỀU KHIỂN ───────────────────────     │
│  ┌Minimap┐                     ┌Xe đang nghĩ: ...┐    │  [DPad]   Tốc độ ━━━━●━━ 60%             │
│  └───────┘                     └──────[▶ Thả xe]┘    │           [Tay | Tự động | Dừng]          │
├───────────────────────────────────────────────────────┤ ─ MỤC TIÊU ─── ○ Né 3 lần ○ 0 va chạm     │
│ StepRail: ①Hiểu ②Lắp 3D ③Nối dây ④Lập trình ⑤Chạy thử │ ─ SERIAL ─── ConsolePanel (dark)          │
└───────────────────────────────────────────────────────┤ [💬 Hỏi bạn đồng hành]   [← Quay lại][Tiếp →]│
```
- 4 tab hiện tại trở thành các bước trong `StepRail` (vẫn dùng chung state `WorkspaceTab`, thêm bước "Hiểu").
- **Tutor chat** chuyển thành bong bóng nổi/ngăn kéo phải (mở khi bấm "Hỏi bạn đồng hành" hoặc khi tutor có
  gợi ý mới — hiện chấm đỏ). Không chiếm chỗ cố định.
- Baud rate, chế độ giả lập, nút telemetry → vào hộp thoại ⚙ / modal Kết nối.
- Màn hình < 1024 px: viewport trên (60vh), panel dưới; StepRail cuộn ngang.

## 5. Chất lượng hình mô phỏng

### 5.1 Sa bàn 2D (SVG — bài 10, 11, 19 và RoverMinimap)
- Sàn: lưới 10 cm (`<pattern>`), đường 50 cm đậm hơn; thước tỉ lệ "50 cm" góc dưới.
- Vật cản: mặt trên sáng + cạnh dưới tối 4 px (giả khối) + bóng mềm (`feGaussianBlur` lệch 3 px).
- Xe ≥ 56 px dài: thân bo góc, 4 bánh, đầu siêu âm **xoay theo servo**, đèn trước sáng khi chạy.
- Siêu âm: nón gradient mờ dần + chấm đỏ ở điểm chạm + số cm cạnh chấm; nhấp nháy 10 Hz.
- Vệt đường đi mờ dần (60 điểm gần nhất). Va chạm: xe rung nhẹ + vòng đỏ lan ra.
- `viewBox` cố định theo cm, co giãn theo khung; tuỳ chọn camera bám xe khi sa bàn lớn.

### 5.2 3D (R3F — bài 7, 13, RoverArena3D, LEGO viewer)
- `scene.background` và `fog` = màu `canvas` → vật thể như đứng trên trang, không "hộp xanh".
- Sàn: `<Grid infiniteGrid fadeDistance={...} cellColor sectionColor>` (drei) thay tấm xám.
- Camera ¾ cao (FOV 35–40°), `OrbitControls` giới hạn góc cực, `minDistance/maxDistance`; nút zoom ở ViewportChrome.
- Ánh sáng: `hemisphereLight` ấm + 1 `directionalLight` có shadow (mapSize 2048, `shadow-radius`) hoặc
  `<SoftShadows>`/`<ContactShadows>`; `toneMapping` ACES, `outputColorSpace` sRGB.
- Gạch LEGO: `RoundedBox` (bevel nhỏ) + chấm stud; màu bão hoà vừa, `roughness .45`.
- Vật thể lấp ~60% khung khi mở; tự `fit` theo bounding box.
- `frameloop="demand"` khi đứng yên; `dpr={[1, 1.75]}` cho máy yếu.

## 6. Chuyển động
- Số HUD đổi mượt (motion `animate` số, 200 ms). Nút có `active:scale-95`.
- Đổi bước: viewport fade 150 ms, panel phải trượt 8 px. Không animate liên tục thứ không cần.
- Hoàn thành bài: confetti + thẻ "Hoàn thành!" nổi trên viewport (đã có canvas-confetti).

## 7. Thứ tự làm (mỗi mục = 1 phiên Claude Code + ảnh chụp trước/sau)

| # | Việc | Kiểm tra |
|---|---|---|
| U1 | Tokens + font (`next/font`, subset vietnamese) + `Surface`, `SectionLabel`, `StatTile` | Không còn màu hex rời trong component mới |
| U2 | Bố cục trang bài học: ViewportChrome full-height, StepRail, panel phải theo bước, tutor thành drawer, dọn header | Ảnh 1280×800 và 1024×768 |
| U3 | Điều khiển: `DPad`, `SegmentedControl`, `LabeledSlider`, `Toggle`, `ConsolePanel` — áp cho bài 10, 11, 19 | Bấm-giữ, WASD, ô ≥ 48 px |
| U4 | Sa bàn 2D mới (§5.1) — làm chung một `ArenaSvg` dùng cho RoverMinimap và bài 10/11/19 | So ảnh trước/sau |
| U5 | 3D (§5.2) — tạo `StageCanvas` dùng chung (nền, lưới, đèn, bóng, camera) cho mọi sim R3F | 60 fps; 1 WebGL context |
| U6 | Trang danh sách bài: thẻ bài có ảnh minh hoạ, tiến độ, cấp độ dạng rail | |
| U7 | Rà toàn bộ 19 bài: thay hộp pastel bằng `Surface`, gom nút | Skill `ui-polish` checklist |
