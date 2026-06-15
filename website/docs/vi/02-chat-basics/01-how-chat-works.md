# Cách chat hoạt động

**Phần:** [Chat cơ bản](README.md) · **Thời gian:** ~10 phút

**Mục tiêu:** Hiểu routing và các loại "approve".

---

## Orchestrator & workers

| Thành phần | Vai trò |
|------------|---------|
| **Orchestrator** | Hiểu intent, hỏi thêm, gọi worker |
| **Worker** | Một job theo runbook (analyze, generate, review…) |

Mô tả trong chat — skills route đến worker đúng. Dùng được cả **Cursor** và **Claude Code**.

---

## Câu lệnh thường dùng

| Muốn… | Gõ |
|-------|-----|
| Generate SRS | *"generate the SRS"* |
| Review/approve doc | *"review documents"*, *"approve srs/01-overview"* |
| Xử lý comments | *"resolve comments"* |
| Analyze sources | *"analyze my data source"* |
| Check workspace | *"check my workspace"* |

Không chắc? Gõ *"help me approve"*.

---

## Bốn loại "approve"

| Ý bạn | Gõ | Không phải |
|-------|-----|------------|
| Approve document | *"approve the SRS"* | spec / plan / comment |
| Approve spec | *"approve SPEC-001"* | document approve |
| Chạy plan | *"yes, go ahead"* | document approve |
| Đóng comment | *"resolve C-012"* | document approve |

---

## Tiếp theo

[Workspace & tasks](02-workspace-and-tasks.md)
