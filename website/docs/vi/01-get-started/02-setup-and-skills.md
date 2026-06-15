# Setup trong chat & bật skills

**Phần:** [Bắt đầu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút · **Trước đó:** [Điều kiện tiên quyết & init](01-prerequisites-and-init.md)

**Mục tiêu:** Hoàn tất setup npm/MCP trong chat và bật skill routing.

---

## Hoàn tất setup trong chat

Mở dự án trong Cursor hoặc Claude Code, rồi nói:

```
setup ai-spector project
```

Agent cài `ai-spector`, xác minh config và in checklist. Xác nhận bằng:

```
check ai-spector setup
```

Duyệt khóa học trong lúc chờ: `npx ai-spector course serve --open --lang vi` hoặc `/course/vi/`

---

## Bật skills

**Cursor:** Settings → Rules → **Agent Skills** → bật mọi thư mục trong `.cursor/skills/`. Reload MCP.

**Claude Code:** Skills tự load từ `.claude/skills/`. Reload MCP bằng restart hoặc `/mcp`.

Skills chính: `ai-spector`, `ai-spector-review`, `ai-spector-graph`, `ai-spector-generate-srs`.

---

## Kiểm tra

```
validate the graph
```

Agent gọi graph tool (graph trống cũng được) — không phải từ chối chung chung.

---

## Phần tiếp theo

[Cơ bản về chat — Cách chat hoạt động](../02-chat-basics/01-how-chat-works.md)
