# Tạo SRS

**Phần:** [Tạo tài liệu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~15 phút · **Trước đó:** [Validate graph](../03-graph/02-validate-index-explore.md)

**Mục tiêu:** Chạy toàn bộ workflow SRS có gate — clarify, plan, viết, phê duyệt specs.

---

## Bắt đầu

```
generate the SRS
```

Agent tạo **task** — chưa ghi file.

---

## Clarify & phê duyệt plan

1. Kiểm tra workspace
2. Câu hỏi làm rõ (câu trả lời lưu cho phiên sau)
3. Briefing: nguồn và graph nodes định hình SRS
4. Bảng plan — trả lời **`yes, go ahead`** (phê duyệt plan — không phải document sign-off)

Tạm dừng bất cứ lúc nào: `pause task` → sau đó `resume my SRS`.

---

## Generation waves

SRS viết theo **waves** (thứ tự phụ thuộc template) trong `docs/srs/`. Tiến độ được lưu — an toàn khi resume nếu bị gián đoạn.

Sau khi viết: `refresh the index`.

Sai nội dung? Sửa `docs/data-source/` → re-analyze → regenerate. Chỉnh trực tiếp `docs/srs/` có thể bị ghi đè khi regen.

---

## Phê duyệt specs đã trích xuất

Sau generate, xem lại mục **SPEC-NNN** — chỉ specs được approve mới merge vào graph:

```
pending specs
approve SPEC-001
reject SPEC-002 — duplicate of UC-003
```

Đây là **spec approval** — không phải document sign-off chính thức (xem [Review & thay đổi](../06-review/01-review-comments-changes.md)).

---

## Kiểm tra

`docs/srs/` có actors và use cases. Specs đã approve xuất hiện trong graph.

---

## Tiếp theo

[Basic design](02-basic-design.md)
