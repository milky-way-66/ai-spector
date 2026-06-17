# Chat hoạt động thế nào

**Phần:** [Cơ bản về chat](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Biết nói gì trong chat và agent sẽ làm gì tiếp theo.

---

## Nói đơn giản

Mô tả nhu cầu bằng ngôn ngữ hàng ngày. Agent chọn quy trình phù hợp, hỏi khi chưa rõ, và chờ bạn phê duyệt trước khi thay đổi lớn.

Bạn **không** cần biết tên công cụ nội bộ hay kiến trúc kỹ thuật.

---

## Cụm từ thường dùng

| Bạn muốn… | Nói (ví dụ) |
|-----------|-------------|
| Thiết lập dự án | *"setup ai-spector project"* |
| Tạo SRS | *"generate the SRS"* |
| Rà soát tài liệu | *"review documents"* |
| Thêm một tính năng | *"I want to add login with Google"* |
| Xử lý phản hồi | *"resolve comments"* |
| Tiếp tục công việc tạm dừng | *"resume my SRS"*, *"active tasks"* |
| Kiểm tra sức khỏe dự án | *"check my workspace"* |

Khi không chắc, nói *"help me approve"* — agent sẽ hỏi bạn muốn gì.

---

## Bạn nói → Agent làm → Bạn thấy

**Bạn nói:** *"help me approve"*

**Agent làm:** Hỏi một câu làm rõ nếu ý định của bạn mơ hồ.

**Bạn thấy:** Menu ngắn (ký duyệt tài liệu vs kế hoạch vs spec vs bình luận) — không tự động phê duyệt.

---

:::exercise
**Dán vào chat:**

```
help me approve
```

**Bạn nên thấy:**
- Agent hỏi bạn muốn loại phê duyệt nào, **hoặc**
- Agent giải thích bốn loại trước khi hành động
:::

:::roletip
**BA / Tester** — đánh dấu dòng *"review documents"* và *"resolve comments"*.
:::

## Nếu có vấn đề

| Triệu chứng | Nói trong chat |
|-------------|----------------|
| Sai quy trình | Diễn đạt lại theo bảng trên; nói *"one feature only"* cho thay đổi nhỏ |
| Agent làm quá nhiều | *"pause task"* rồi làm rõ phạm vi |
| Không có gì xảy ra | *"check my workspace"* |

---

## Tiếp theo

[Bốn loại phê duyệt](02-four-kinds-of-approve.md)
