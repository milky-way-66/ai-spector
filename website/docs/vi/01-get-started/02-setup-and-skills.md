# Setup & skills

**Phần:** [Bắt đầu](README.md) · **Trước:** [Prerequisites & init](01-prerequisites-and-init.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Hoàn tất setup trong chat, bật skills.

---

## Setup trong chat

```
setup ai-spector project
check ai-spector setup
```

Xem khóa học lúc chờ: `npx ai-spector course serve --open --lang vi`

---

## Bật skills

**Cursor:** Settings → Rules → **Agent Skills** → bật `.cursor/skills/`. Reload MCP.

**Claude Code:** Skills từ `.claude/skills/`. Reload MCP: restart hoặc `/mcp`.

Skills chính: `ai-spector`, `ai-spector-review`, `ai-spector-graph`, `ai-spector-generate-srs`.

---

## Check

```
validate the graph
```

Graph trống cũng OK — agent phải gọi được graph tool.

---

## Tiếp theo

[Cách chat hoạt động](../02-chat-basics/01-how-chat-works.md)
