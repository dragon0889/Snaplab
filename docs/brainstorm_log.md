# Brainstorm log

## lesson-18: Trạm thời tiết mini cảnh báo nắng nóng (Cấp 4)
- Ý tưởng: kết hợp 2 cảm biến (ánh sáng + nhiệt độ) bằng khối Và / Hoặc; đèn RGB báo tình huống, còi báo nắng nóng > 35°C.
- Chỉ dùng khối đã có (đọc ánh sáng/nhiệt độ, so sánh, Và/Hoặc, đèn RGB, bíp, hiển thị bảng).
- Điều kiện thắng: tuần tự WEATHER_DAY_COOL → WEATHER_NIGHT → WEATHER_HEAT_ALERT (metric `weather_station_alert`).
- Lỗi thường gặp: kiểm tra "trời tối" sau cảnh báo nóng khiến đèn không đỏ; sim nhắc gợi mở (không đưa đáp án).

## lesson-19: Xe Robot an toàn: Cử chỉ tay + Tự phanh (Cấp 4)
- Ý tưởng: cử chỉ tay ra lệnh tiến, nhưng cảm biến siêu âm có quyền ưu tiên an toàn (vật cản < 15 cm → dừng).
- Chỉ dùng khối đã có (cử chỉ tay, siêu âm, so sánh, Và/Hoặc, lái xe).
- Điều kiện thắng: tuần tự GESTURE_FORWARD_CLEAR → OBSTACLE_AUTO_STOP → RESUME_AFTER_CLEAR (metric `safe_gesture_drive`).
- Lỗi thường gặp: lệnh tay được xét sau cảm biến nên đè lệnh dừng; sim nhắc khi xe vẫn tiến sát vật cản.

Ghi chú: bước Brainstorm/Review do chính trợ lý thực hiện trực tiếp (không dùng subagent) theo yêu cầu "thêm lesson 18, 19".
