# AI Spector là gì?

**Phần:** [Chào mừng](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Hiểu rằng bạn mô tả nhu cầu trong chat — agent lo phần kỹ thuật.

---

## Nói đơn giản

AI Spector giúp nhóm biến yêu cầu thành tài liệu có cấu trúc (SRS, thiết kế, rà soát). **Bạn trò chuyện với agent trong Cursor hoặc Claude Code.** Bạn không cần nhớ lệnh hay chỉnh file cấu hình cho công việc hàng ngày.

| Bạn làm | Agent làm |
|---------|-----------|
| Nói bạn cần gì | Chọn quy trình phù hợp |
| Trả lời câu hỏi làm rõ | Đọc dự án và nguồn dữ liệu |
| Phê duyệt kế hoạch khi được hỏi | Viết tài liệu và cập nhật dự án |

---

## Bạn nói → Agent làm → Bạn thấy

**Bạn nói:** *"open the course"*

**Agent làm:** Mở khóa học trong trình duyệt và chỉ bạn đến bài học đúng.

**Bạn thấy:** Một liên kết như `http://127.0.0.1:4177/course/en/index` và tóm tắt ngắn.

---

:::exercise
**Dán vào chat:**

```
open the course
```

**Bạn nên thấy:**
- Agent chạy server khóa học (hoặc gửi liên kết nếu đã chạy)
- Trình duyệt mở trang chủ khóa học
- Agent tóm tắt bài học này trong chat — không phải toàn bộ nội dung
:::

:::roletip
**Mọi người** — đánh dấu URL khóa học để tra cứu nhanh.
:::

## Nếu có vấn đề

| Triệu chứng | Nói trong chat |
|-------------|----------------|
| Cổng đã được dùng | *"course server port is busy"* — đóng cửa sổ khác hoặc nhờ developer |
| Không tìm thấy khóa học | *"setup ai-spector project"* trước (bài học tiếp theo) |

---

## Tiếp theo

[Thiết lập qua chat](../02-get-started/01-setup-via-chat.md)
