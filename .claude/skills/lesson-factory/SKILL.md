---
name: lesson-factory
description: Quy trình tự động sáng tạo, phản biện và lập trình hoàn chỉnh bài học STEAM mới cho SnapLab. Sử dụng khi người dùng yêu cầu tự nghĩ thêm bài học mới hoặc mở rộng chương trình học.
---

# Quy trình Nhà máy Sản xuất Bài học Tự động (SnapLab Lesson Factory)

Khi người dùng yêu cầu tạo thêm $N$ bài học mới (mặc định $N = 1$), hãy thực thi tuần tự từng bài theo đúng 3 giai đoạn sau:

## Giai đoạn 1: Khởi tạo ý tưởng (Brainstorming)
- Gọi subagent `lesson-brainstormer` kèm yêu cầu cấp độ mong muốn (hoặc để agent tự chọn cấp độ còn thiếu nhiều bài nhất).
- Lưu tạm bản nháp `LessonConfig` nhận được trong ngữ cảnh hiện tại.

## Giai đoạn 2: Vòng lặp Phản biện (Review Gate — Tối đa 2 lần sửa)
- Gửi toàn bộ bản nháp `LessonConfig` sang cho subagent `lesson-reviewer` đánh giá.
- **Nếu nhận được `VERDICT: REJECTED`:**
  - Gửi lại bản nháp kèm nhận xét của reviewer cho `lesson-brainstormer` chỉnh sửa, sau đó gửi lại cho `lesson-reviewer`.
  - Nếu sau 2 lần sửa vẫn bị từ chối, hủy bỏ ý tưởng này và yêu cầu `lesson-brainstormer` nghĩ một ý tưởng khác hoàn toàn.
- **Nếu nhận được `VERDICT: APPROVED`:** Chuyển ngay sang Giai đoạn 3.

## Giai đoạn 3: Lập trình & Kiểm chứng (Implementation)
- Chuyển bản thiết kế đã được duyệt sang cho subagent `lesson-coder` để:
  1. Ghi dữ liệu vào `src/lib/lessons-data/curriculum.ts`.
  2. Code component mô phỏng tương tác `src/components/simulations/LessonXXSim.tsx` và đăng ký vào giao diện bài học.
  3. Chạy `npm run typecheck` xác nhận build sạch lỗi.
- Báo cáo ngắn gọn cho người dùng: Tên bài học mới, Cấp độ, Linh kiện sử dụng và đường dẫn component vừa tạo.