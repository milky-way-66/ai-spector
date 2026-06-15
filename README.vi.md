# AI Spector

Công cụ làm tài liệu phần mềm trên **Cursor** hoặc **Claude Code**: sơ đồ liên kết, SRS, basic design và prototype UI (HTML tĩnh hoặc SPA build ra file tĩnh). **Bạn chỉ cần nói trong chat** — agent sẽ tự chạy lệnh `ai-spector` hoặc MCP. Thường bạn không cần gõ lệnh terminal.

**Cần có:** Node 20+, Git, [Cursor](https://cursor.com) và/hoặc [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Python 3.11+ *(không bắt buộc — dùng cho tìm kiếm thông minh với CocoIndex)*.

Hướng dẫn chi tiết: [docs/setup-guide.md](docs/setup-guide.md)

**English:** [README.md](README.md)

---

## Cài đặt (làm một lần)

### Cần chuẩn bị gì

| Cần có | Cách kiểm tra |
|--------|---------------|
| Node.js ≥ 20 | `node --version` |
| Git | `git status` |
| Cursor và/hoặc Claude Code | Mở IDE ở thư mục gốc project |
| Python ≥ 3.11 *(không bắt buộc)* | chỉ cần nếu bật CocoIndex |

---

### Bước 1 — Khởi tạo project *(bước duy nhất cần gõ lệnh)*

Chạy một lần ở thư mục gốc project. **Lần đầu** cần thêm `--registry` để `npx` tải gói từ registry nội bộ (`http://10.101.0.239:4873`). **Không cần** `npm login`.

```bash
npx ai-spector@latest init --registry http://10.101.0.239:4873
```

Lệnh sẽ hỏi: dùng Cursor, Claude Code hay cả hai; ngôn ngữ tài liệu; git hook; và có bật CocoIndex không.

Sau khi chạy xong sẽ có:

- `.ai-spector/` — cấu hình, sơ đồ, mẫu tài liệu
- `docs/data-source/`, `docs/srs/`, `docs/basic-design/`
- **Cursor:** `.cursor/` — skills, rules, `mcp.json`
- **Claude Code:** `CLAUDE.md` + `.claude/skills/` + `.mcp.json`
- Hook git trước khi commit *(nếu project có git)*

---

### Bước 2 — Hoàn tất setup trong chat

Mở project bằng **Cursor** hoặc **Claude Code**, rồi gõ:

```text
setup ai-spector project
```

Agent sẽ cài gói npm (nếu thiếu), kiểm tra xem còn thiếu gì, hỏi bạn có muốn bật CocoIndex không, và nhắc các bước còn lại.

---

### Bước 3 — Bật skills *(làm tay một lần)*

**Cursor**

1. Vào **Settings → Rules → Agent Skills** — bật **hết** các thư mục trong `.cursor/skills/` (xem `.cursor/skills/README.md`)
2. **Reload MCP** — file `.cursor/mcp.json` đã cấu hình sẵn server `ai-spector`

**Claude Code**

1. Skills tự load từ `.claude/skills/` (xem `CLAUDE.md`)
2. **Reload MCP** — file `.mcp.json` đã cấu hình sẵn server `ai-spector`

---

### Bước 4 — Thêm tài liệu đầu vào

Copy file yêu cầu, biên bản họp, user story… vào `docs/data-source/`. Hỗ trợ: `.md`, `.txt`, `.pdf`.

---

### Bước 5 — Bắt đầu làm việc

Trong chat, gõ:

```text
analyze my data source
```

Các bước tiếp theo cũng nói trong chat — xem [Quy trình làm việc](#quy-trình-làm-việc) bên dưới.

---

### Tùy chọn — Bật CocoIndex (tìm kiếm thông minh)

Giúp agent tìm tài liệu và sơ đồ theo nghĩa, không chỉ theo từ khóa. Cần Python ≥ 3.11.

Trong chat:

```text
enable CocoIndex for this project
```

Xem thêm [docs/setup-guide.md](docs/setup-guide.md) nếu muốn dùng Postgres hoặc OpenAI embedding.

---

### Thêm editor khác sau này

Trong chat:

```text
add Claude Code support to ai-spector
sync ai-spector cursor skills
```

Sau khi nâng cấp ai-spector, gõ **"sync ai-spector cursor skills"** trong chat.

---

## Quy trình làm việc

Sau khi `init`, xem thêm `.cursor/WORKFLOW.md` (Cursor) hoặc `CLAUDE.md` (Claude Code).

### Lần đầu chạy

Gõ trong chat:

```text
“analyze the data source”
“validate the graph”
“generate the SRS”
“refresh the index”
```

Tiếp theo: **“generate basic design”** khi cần.

**Prototype** — HTML tĩnh (mặc định) hoặc SPA (React/Vue/… build ra `prototype/dist/`). Gõ **“generate prototype”** hoặc **“generate HTML prototype”** cho HTML; **“generate prototype with Vue”** (hoặc React) cho SPA. Nếu chưa chọn theme, agent gợi ý 3 theme, mở xem trên trình duyệt, rồi chờ bạn chọn. Hoặc nói luôn: **“prototype with stripe theme”**.

Sau đó: **“generate prototype for all screens”**. Với SPA, chạy build framework rồi `npx ai-spector prototype sync`.

### Dùng hàng ngày

| Khi nào | Gõ trong chat (ví dụ) |
|---------|------------------------|
| Có tài liệu nguồn mới hoặc sửa | “analyze data source” |
| Kiểm tra sơ đồ | “validate the graph” |
| Tạo lại tài liệu | “generate SRS”, “generate basic design”, … |
| Prototype (HTML hoặc SPA) | “generate prototype”, “generate prototype with Vue”, “prototype with stripe theme” |
| Chọn theme | “help me pick a prototype theme”, “show me theme options” |
| Vừa sửa tài liệu xong | “re-index the graph” |
| Đồng bộ đa ngôn ngữ | “add language vi”, “resolve translations” — [Translations](docs/course/05-prototype/01-translations.md) |
| Template tùy chỉnh | “set up template pack”, `generate <pack-name>` — [Custom templates](docs/course/07-advanced/01-custom-templates.md) |
| Xem phần nào bị ảnh hưởng | “what’s the impact of my changes” |
| Xử lý comment | “resolve comments” |
| Xem sơ đồ trực quan | “visualize the graph” |

### Quy trình thường gặp

```text
docs/data-source/  →  analyze  →  validate graph  →  generate SRS  →  index
                              →  generate basic design
                              →  prototype setup  →  generate screens (HTML hoặc SPA build)
```

---

## CLI (nếu cần)

Chỉ dùng khi viết script hoặc debug: `npx ai-spector index`, `graph validate`, `graph visualize --open`, `graph impact --git`, `prototype auth|themes|preview|setup|manifest|validate`. Gõ `npx ai-spector --help` để xem đầy đủ.

---

## Gặp lỗi thì làm gì

| Lỗi | Cách xử lý |
|-----|------------|
| MCP không chạy | Reload MCP; kiểm tra `.cursor/mcp.json` hoặc `.mcp.json` có server `ai-spector` |
| Setup chưa xong | Trong chat: **“check ai-spector setup”** |
| Agent không hiểu lệnh (Cursor) | Bật lại hết thư mục trong `.cursor/skills/` ở Settings → Rules |
| Validate báo lỗi sau khi sửa | Trong chat: **“re-index the graph”** |
| Thiếu hook git | Trong chat: **“install ai-spector git hook”** |
| Agent bị kẹt vì lỗi CLI | Xem `.cursor/skills/ai-spector/references/cli-failures.md` |

---

## Node SDK

Dùng khi bạn viết **script, CI, hoặc backend tùy chỉnh** — cùng các thao tác typed như CLI và MCP:

- **[Hướng dẫn SDK](docs/sdk.md)** — cài đặt, entry points, ví dụ, tham chiếu API

```bash
npm install ai-spector
```

```ts
import { runIndex, runGraphImpact, validateGraph } from "ai-spector";
```

---

## Web / graph SDK

Dùng khi bạn muốn **hiển thị sơ đồ trên web hoặc dashboard riêng** (không qua Cursor/Claude). Cài gói **`ai-spector-graph`**, backend trả JSON từ repo, frontend load vào `ProjectSession`.

- **[Hướng dẫn tích hợp](docs/ai-spector-graph-integration-guide.md)** — kiến trúc, ví dụ API, React
- **[Tham chiếu API](docs/ai-spector-graph.md)** — types và exports

```bash
npm install ai-spector-graph
```

---

## Phát triển (cho người đóng góp code)

```bash
npm install && npm run build && npm test
```

MIT — [LICENSE](LICENSE).
