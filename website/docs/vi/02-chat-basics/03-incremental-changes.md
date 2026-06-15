# Thay đổi từng phần

**Phần:** [Chat cơ bản](README.md) · **Thời gian:** ~10 phút · **Trước:** [Workspace & tasks](02-workspace-and-tasks.md)

**Mục tiêu:** Thêm/sửa một feature hoặc section mà không generate lại cả SRS.

---

## Khi nào dùng

| Tình huống | Dùng | Không dùng |
|------------|------|------------|
| Thêm login Google, sửa một section API | **resolve-task** | `generate the SRS` |
| Viết cả chapter từ graph | generate-srs | resolve-task |
| Sign-off document hoàn chỉnh | ai-spector-review | resolve-task |

Skill: **`ai-spector-resolve-task`**

---

## Bắt đầu

```
I want to add login with Google
```

hoặc *"update the auth section"*, *"add requirement for password reset"*.

Agent tạo **task** — chưa sửa file.

---

## Bạn sẽ thấy gì

1. **Câu hỏi clarify** — phạm vi, file đích, ràng buộc.
2. **Bảng GoalSpec + TaskPlan** — sẽ đổi gì, file nào, impact graph.
3. Agent **chờ** bạn **`yes, go ahead`** hoặc approve plan.
4. Sau approve: sửa có mục tiêu, rồi `index` nếu cần.
5. Task complete khi xong.

**Trên disk:** chỉ file doc thay đổi — không rewrite cả `docs/srs/`.

---

## Troubleshooting

| Triệu chứng | Cách xử lý |
|-------------|------------|
| Agent nhảy sang generate SRS | Nói *"this is one feature only"* |
| Sửa trước khi bạn đồng ý | Thiếu `task_approve_plan` |
| Sửa nhầm section | Nói rõ path: *"update srs/03-features"* |

---

## Tiếp theo

[Graph & sources](../03-graph/README.md)
