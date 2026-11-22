---
name: pre-deploy-readiness
description: Quy trình chuẩn hóa kiến trúc Docker, kiểm định bảo mật trẻ em/phần cứng và kiểm thử production build trước khi deploy SnapLab lên VPS.
---

# Quy trình Chuẩn bị Triển khai VPS (SnapLab Pre-Deploy Pipeline)

Thực thi tuần tự 3 giai đoạn sau để đảm bảo mã nguồn sẵn sàng cho người dùng thử nghiệm trên VPS:

1. **Thiết kế Hạ tầng (`solution-architect`):**
   - Gọi subagent `solution-architect` để cấu hình `next.config.ts` (`standalone`), tạo `Dockerfile`, `docker-compose.yml`, `Caddyfile` (HTTPS tự động) và lớp cổng mời `BETA_ACCESS_CODE`.
2. **Kiểm định Bảo mật (`security-auditor`):**
   - Gọi subagent `security-auditor` rà soát toàn bộ mã nguồn, API `/api/tutor`, quyền `Permissions-Policy` cho WebSerial/Webcam và chạy `npm audit`.
3. **Vá lỗi & Build Kiểm chứng (`devops-qa`):**
   - Chuyển kết quả từ `security-auditor` sang cho `devops-qa` để khắc phục toàn bộ lỗi bảo mật, tạo `/api/health`, viết script `deploy-vps.sh` và chạy `npm run typecheck && npm run build`.
   - Chỉ báo cáo hoàn tất khi `npm run build` thành công 100%.