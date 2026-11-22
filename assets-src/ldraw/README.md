# Nguồn mô hình khối lắp ghép (LDraw)

Đặt ở đây file `.mpd` (hoặc `.ldr`) xuất từ BrickLink Studio hoặc LeoCAD, **đặt tên theo mã bài**: `lesson-05.mpd`.
Quy ước dựng mô hình (chia bước, `ANCHOR_*`, dòng `0 !SNAPLAB STEP "..."`): xem `docs/ldraw-pipeline.md` §2.

Đóng gói để web dùng được:

```
npm run models:pack
```

Lệnh này đọc mọi file trong thư mục này và ghi `public/models/<mã bài>.mpd` + `<mã bài>.steps.json`
(hai file sinh ra này **được commit**, để Docker build không cần thư viện chi tiết). Không sửa tay trong `public/models/`.

Cần có thư viện chi tiết chính thức ở `vendor/ldraw/` (tải `complete.zip` từ ldraw.org rồi giải nén vào đó; thư mục này
không commit). Chưa có file nguồn nào thì lệnh chỉ báo "nothing to pack".

Sau khi đóng gói, thêm vào `curriculum.ts` của bài đó:

```ts
assembly: { model: "/models/lesson-05.mpd", steps: "/models/lesson-05.steps.json" },
```

và `legoStepCount` phải bằng `stepCount` trong `steps.json` (test sẽ kiểm tra).
