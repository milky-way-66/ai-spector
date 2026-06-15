---
sidebar_position: 2
---

# AI Spector — Tổng quan khóa học

Quy trình tài liệu trong **Cursor** hoặc **Claude Code**: traceability graph, SRS, basic design, prototypes. **Mô tả những gì bạn cần trong chat.**

Duyệt khóa học: `npx ai-spector course serve --open --lang vi` hoặc `/course/vi/`

**Trong chat:** *"mở khóa học ai-spector"* · *"hướng dẫn tôi dùng ai-spector"* · *"cho tôi xem cách chat hoạt động"*

---

## Cấu trúc

**7 phần, 13 bài học** — mỗi bài ~10–15 phút, một nhiệm vụ mạch lạc. Không chia nhỏ các bước bạn có thể hoàn thành trong một lần ngồi.

| Phần | Bài học |
|------|---------|
| [Bắt đầu](01-get-started/README.md) | Điều kiện tiên quyết & init · Setup & skills |
| [Cơ bản về chat](02-chat-basics/README.md) | Cách chat hoạt động · Workspace & tasks |
| [Graph & nguồn dữ liệu](03-graph/README.md) | Nguồn & analyze · Validate & explore |
| [Tạo tài liệu](04-generate/README.md) | Tạo SRS · Basic design |
| [Thiết kế & prototype](05-prototype/README.md) | Bản dịch *(tùy chọn)* · Build prototype |
| [Review & thay đổi](06-review/README.md) | Review, comments & chỉnh sửa tăng dần |
| [Nâng cao](07-advanced/README.md) | Custom templates · Search & editors |

---

## Pipeline

```text
docs/data-source/ → analyze → validate → generate SRS (gated) → basic design
  → prototype → review documents
```

Mỗi lần **generate**: kiểm tra workspace → clarify → phê duyệt plan → waves → spec review.

---

## Tiếp theo

[Bắt đầu](01-get-started/README.md)
