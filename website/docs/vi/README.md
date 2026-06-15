---
sidebar_position: 1
---

# Khóa học AI Spector

Các bài học tập trung về cách dùng AI Spector trong **Cursor** hoặc **Claude Code**. Phần lớn công việc diễn ra trong chat.

**Bắt đầu:** [Tổng quan](00-overview.md) → [Bắt đầu](01-get-started/README.md)

---

## Xem trên trình duyệt

```bash
npx ai-spector course serve --open --lang vi
```

Hoặc mở `/course/vi/` sau khi server đang chạy.

**Trong chat:** nói *"mở khóa học ai-spector"* hoặc *"hướng dẫn tôi dùng ai-spector"* — agent sẽ khởi động server và liên kết đúng bài học.

---

## Các phần *(13 bài học)*

| Phần | Bài học | Nội dung |
|------|---------|----------|
| [Bắt đầu](01-get-started/README.md) | 2 | Cài đặt, init, skills |
| [Cơ bản về chat](02-chat-basics/README.md) | 2 | Routing, workspace, tasks |
| [Graph & nguồn dữ liệu](03-graph/README.md) | 2 | Analyze, validate, index |
| [Tạo tài liệu](04-generate/README.md) | 2 | SRS (có gate) + basic design |
| [Thiết kế & prototype](05-prototype/README.md) | 2 | Bản dịch, UI mockup |
| [Review & thay đổi](06-review/README.md) | 1 | Sign-off, comments, chỉnh sửa |
| [Nâng cao](07-advanced/README.md) | 2 | Templates, search, editors |

---

## Lộ trình nhanh

| Mục tiêu | Theo dõi |
|----------|----------|
| Dự án đầu tiên | Bắt đầu → Chat → Graph → Generate |
| Triển khai chuẩn | + Prototype → Review |
| Đa ngôn ngữ | Thêm [Bản dịch](05-prototype/01-translations.md) sau SRS |
| SRS tùy chỉnh | [Custom templates](07-advanced/01-custom-templates.md) trước Graph |

---

## Tham khảo

- [Multi-template packs](../../plan/multi-template-structure.md)
- [SDK](../../plan/sdk.md)
