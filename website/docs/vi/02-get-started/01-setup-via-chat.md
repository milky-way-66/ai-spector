# Thiết lập qua chat

**Phần:** [Bắt đầu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Chuẩn bị dự án bằng cách nhờ agent — không cần gõ lệnh terminal.

---

## Nói đơn giản

Trước khi tạo tài liệu, dự án cần thiết lập một lần: thư mục, kỹ năng cho agent, và cấu hình. **Nhờ agent thiết lập giúp bạn.**

Bạn cần:
- Kho Git (thư mục dự án của bạn)
- Cursor hoặc Claude Code với AI Spector đã cài trong dự án

---

## Bạn nói → Agent làm → Bạn thấy

**Bạn nói:** *"setup ai-spector project"*

**Agent làm:** Chạy quy trình thiết lập — kiểm tra workspace, cài scaffolding, và liệt kê những gì bạn nên bật.

**Bạn thấy:**
- Danh sách kiểm tra các thư mục đã tạo (`docs/data-source/`, `.ai-spector/`, skills)
- Nhắc bật skills trong `.cursor/skills/`
- Tùy chọn chạy *"check my workspace"* khi xong

---

:::exercise
**Dán vào chat:**

```
setup ai-spector project
```

**Bạn nên thấy:**
- Agent hướng dẫn từng bước thiết lập (không ghi file im lặng)
- `docs/data-source/` được nhắc là nơi đặt đầu vào của bạn
- Không có lỗi ở cuối quá trình thiết lập
:::

:::roletip
**Developer** — bạn có thể xem agent chạy lệnh CLI; bạn không cần tự gõ.
:::

:::behind
Developer cũng có thể chạy `npx ai-spector setup -y` từ terminal. Công việc hàng ngày vẫn diễn ra trong chat.
:::

## Nếu có vấn đề

| Triệu chứng | Nói trong chat |
|-------------|----------------|
| Chưa phải git repo | Nhờ developer chạy `git init`, hoặc nói *"initialize git repo"* |
| Chưa cài package | *"install ai-spector in this project"* |
| Agent không định tuyến đúng | *"check my workspace"* — agent liệt kê skills còn thiếu |

---

## Tiếp theo

[Chat hoạt động thế nào](../03-chat-basics/01-how-chat-works.md)
