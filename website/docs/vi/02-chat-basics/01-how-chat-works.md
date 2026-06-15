# Cách chat hoạt động

**Phần:** [Cơ bản về chat](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Hiểu routing và ý nghĩa của “approve”.

---

## Orchestrator & workers

| Tầng | Vai trò |
|------|---------|
| **Orchestrator** | Phân loại intent, hỏi câu routing, spawn workers |
| **Worker** | Một job theo runbook (analyze, generate, review…) |

Mô tả nhu cầu trong chat — skills định tuyến đến worker phù hợp. Cùng cụm từ dùng được trong **Cursor** và **Claude Code**.

---

## Cụm từ thường dùng

| Bạn muốn… | Nói (ví dụ) |
|-----------|-------------|
| Tạo SRS | *"generate the SRS"*, *"write use cases"* |
| Sign-off tài liệu | *"review documents"*, *"approve srs/01-overview"* |
| Xử lý feedback | *"resolve comments"*, *"show open comments"* |
| Analyze nguồn | *"analyze my data source"* |
| Kiểm tra workspace | *"check my workspace"* |

Không chắc? Nói *"help me approve"* — agent hỏi một câu làm rõ.

---

## Bốn loại “approve”

| Ý bạn | Nói | Không phải |
|-------|-----|------------|
| Sign-off tài liệu | *"review srs/01-overview"*, *"approve the SRS"* | spec / plan / comment |
| Phê duyệt spec đã trích xuất | *"approve SPEC-001"* | document sign-off |
| Thực thi plan | *"yes, go ahead"* sau bảng plan | document sign-off |
| Đóng comment thread | *"resolve C-012"* | document sign-off |

---

## Tiếp theo

[Workspace & tasks](02-workspace-and-tasks.md)
