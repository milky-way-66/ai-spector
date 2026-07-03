# AI Spector

Công cụ làm tài liệu trên **Cursor** hoặc **Claude Code**: sơ đồ liên kết, SRS, basic/detail design, prototype. **Chỉ cần nói trong chat** — agent chọn một trong **4 skills** và gọi MCP. Thường không cần terminal.

**Cần có:** Node 20+, Git, Cursor và/hoặc Claude Code · Python 3.11+ tùy chọn (CocoIndex)

**Học cách dùng:** `npx ai-spector course serve --open` · [Course](website/docs/vi/README.md) · [English](README.md)

---

## Bắt đầu nhanh

**1. Cài một lần** (thư mục gốc project):

```bash
npm install ai-spector --registry http://10.101.0.239:4873
npx ai-spector init
```

npm công khai: bỏ `--registry …`.

**2. Hoàn tất trong chat:**

```text
setup ai-spector project
```

**3. Bật skills** (một lần): Settings → Agent Skills → bật cả 4 thư mục trong `.cursor/skills/` (hoặc `.claude/skills/`). Reload MCP.

**4. Thêm nguồn** vào `docs/data-source/`, rồi:

```text
analyze my data source
```

Bản đồ đầy đủ: `.cursor/WORKFLOW.md` hoặc `CLAUDE.md` sau khi init.

---

## Nói gì trong chat

Bốn skills — nói mục tiêu; agent đọc runbook và gọi tool.

| Skill | Bạn muốn… | Ví dụ prompt |
|-------|-----------|--------------|
| **ai-spector** | Setup, upgrade, adopt, check, docops, work | `setup ai-spector project` · `upgrade ai-spector` · `check my workspace` · `migrate existing docs to docops` · `resume my SRS` |
| **ai-spector-generate** | SRS, design, prototype, một feature/section | `generate the SRS` · `generate basic design` · `generate prototype with Vue` · `I want to add login with Google` |
| **ai-spector-graph** | Index, validate, impact, search, drift | `validate the graph` · `re-index the graph` · `what's the impact of my changes` · `find mentions of rate limiting` |
| **ai-spector-contract** | Review, comments, dịch | `review documents` · `approve srs/01-overview` · `resolve comments` · `add language vi` |

**Approve** dễ nhầm (duyệt tài liệu vs duyệt plan vs comment). Agent sẽ hỏi lại nếu chưa rõ.

### Lần chạy đầu

```text
analyze the data source
validate the graph
generate the SRS
```

Sinh tài liệu có gate: làm rõ → bảng plan → bạn **đồng ý** → viết theo wave → index.

Tiếp theo:

```text
generate basic design
generate prototype
review documents
```

### Hàng ngày

| Khi nào | Nói |
|---------|-----|
| Nguồn mới / sửa | `analyze data source` |
| Vừa sửa docs | `re-index the graph` |
| Một phần / feature | `update the auth section` · `I want to add …` |
| Kẹt setup | `check ai-spector setup` · `help` |
| Skills cũ sau upgrade | `upgrade ai-spector` |
| Tìm kiếm semantic (tùy chọn) | `enable CocoIndex for this project` |

---

## Khi chat chưa đủ

| Tình huống | Thử prompt trước | CLI dự phòng |
|------------|------------------|--------------|
| Kiểm tra setup | `check ai-spector setup` | `npx ai-spector setup --check` |
| Chỉ contract Writer | `docops status` | `npx ai-spector docops status --json` |
| Mở khóa học | `open the ai-spector course` | `npx ai-spector course serve --open` |
| Xem graph trên browser | `show the graph` | `npx ai-spector graph visualize --open` |

Đầy đủ lệnh: `npx ai-spector --help` · [cli-reference](scaffold/cursor/skills/ai-spector/references/cli-reference.md)

---

## Gặp lỗi

| Lỗi | Nói trong chat |
|-----|----------------|
| Thiếu MCP | Reload MCP; kiểm tra server `ai-spector` trong `.cursor/mcp.json` hoặc `.mcp.json` |
| Setup chưa xong | `check ai-spector setup` |
| Agent không route skill | Bật lại cả **4** thư mục skill |
| Validate lỗi sau sửa | `re-index the graph` |
| Lỗi CLI | Agent dùng [cli-failures](scaffold/cursor/skills/ai-spector/references/cli-failures.md) |

---

## Thêm

| Chủ đề | Tài liệu |
|--------|----------|
| Cấu hình (`.docops/` + `.ai-spector/`) | [CONTRACT.md](../kari-writer/contracts/CONTRACT.md) |
| Migrate legacy | [MIGRATION.md](../kari-writer/contracts/MIGRATION.md) |
| Node SDK | [docs/plan/sdk.md](docs/plan/sdk.md) |
| Graph trên web | [docs/ai-spector-graph-integration-guide.md](docs/ai-spector-graph-integration-guide.md) |
| CocoIndex | [docs/setup-guide.md](docs/setup-guide.md) |
| Đóng góp / publish | `npm install && npm run build && npm test` · `npm run deploy` (nội bộ) · `npm run deploy:npm` (public) |

MIT — [LICENSE](LICENSE).
