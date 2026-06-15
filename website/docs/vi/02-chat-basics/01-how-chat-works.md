# Cách chat hoạt động

**Phần:** [Chat cơ bản](README.md) · **Thời gian:** ~10 phút

**Mục tiêu:** Hiểu routing và các loại "approve".

---

## Skills & routing

| Thành phần | Vai trò |
|------------|---------|
| **Routing** | `_skill-router.md` + `ai-spector-routing.mdc` chọn skill |
| **Skill** | Một workflow với runbook trong `references/` |

Mô tả trong chat — agent đọc skill và làm theo runbook. Dùng được **Cursor** và **Claude Code**.

Intent chưa rõ → **`workflow_route`** hoặc hỏi một câu.

**Tham khảo:** `.cursor/WORKFLOW.md`

---

## Skill map (tham khảo nhanh)

| Muốn… | Skill | Ví dụ |
|-------|-------|-------|
| Setup / check | `ai-spector-setup` / `check` | `setup ai-spector project` |
| Graph | `ai-spector-graph` | `analyze my data source` |
| Generate SRS | `ai-spector-generate-srs` | `generate the SRS` |
| Sửa một phần | `ai-spector-resolve-task` | `I want to add login with Google` |
| Sign-off doc | `ai-spector-review` | `review documents`, `approve srs/01-overview` |
| Comments | `ai-spector-resolve-comments` | `resolve comments` |
| Resume task | `ai-spector-task` | `resume my SRS` |

---

## Bốn loại "approve"

| Ý bạn | Gõ | Không phải |
|-------|-----|------------|
| Approve document | *"approve the SRS"* | spec / plan / comment |
| Approve spec | *"approve SPEC-001"* | document approve |
| Chạy plan | *"yes, go ahead"* | document approve |
| Đóng comment | *"resolve C-012"* | document approve |

Không chắc? Gõ *"help me approve"*.

---

## Bạn sẽ thấy gì

- Agent chọn đúng skill; ambiguous approve → menu 4 lựa chọn.
- Bật hết skills trong `.cursor/skills/`.

---

## Tiếp theo

[Workspace & tasks](02-workspace-and-tasks.md)
