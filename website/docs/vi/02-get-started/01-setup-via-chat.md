# Cài đặt qua chat

**Phần:** [Bắt đầu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Học xong sẽ biết:** Nhờ AI cài đặt dự án — không cần mở terminal.

---

## Tóm lại

Trước khi viết tài liệu, dự án cần cài đặt một lần: tạo thư mục, bật tính năng cho AI, v.v. **Chỉ cần nhắn AI làm giúp.**

Bạn cần có:
- Thư mục dự án đang dùng Git
- Cursor hoặc Claude Code, đã cài AI Spector trong dự án

---

## Ví dụ thực tế

**Bạn nhắn:** *"setup ai-spector project"*

**AI làm:** Kiểm tra dự án, cài file cần thiết, liệt kê việc bạn cần bật thêm.

**Bạn thấy:**
- Các thư mục đã tạo (`docs/data-source/`, `.ai-spector/`, …)
- Nhắc bật skill trong `.cursor/skills/`
- Gợi ý chạy *"check my workspace"* khi xong

---

:::exercise
**Copy câu này vào chat (tiếng Anh):**

```
setup ai-spector project
```

**Kết quả mong đợi:**
- AI hướng dẫn từng bước (không âm thầm sửa file)
- Có nhắc `docs/data-source/` là nơi bạn để tài liệu đầu vào
- Kết thúc không báo lỗi
:::

:::roletip
**Lập trình viên** — có thể xem AI chạy lệnh; bạn không bắt buộc phải tự gõ.
:::

:::behind
Dev có thể chạy `npx ai-spector setup -y` trong terminal. Việc hằng ngày vẫn nên làm qua chat.
:::

## Gặp lỗi?

| Tình huống | Nhắn trong chat |
|------------|-----------------|
| Chưa có Git | Nhờ dev chạy `git init`, hoặc *"initialize git repo"* |
| Chưa cài package | *"install ai-spector in this project"* |
| AI không hiểu lệnh | *"check my workspace"* — AI liệt kê phần còn thiếu |

---

## Bài tiếp

[Cách dùng chat](../03-chat-basics/01-how-chat-works.md)
