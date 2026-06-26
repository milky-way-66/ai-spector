# AI Spector

Công cụ làm tài liệu phần mềm trên **Cursor** hoặc **Claude Code**: sơ đồ liên kết, SRS, basic design và prototype UI (HTML tĩnh hoặc SPA build ra file tĩnh). **Bạn chỉ cần nói trong chat** — agent chọn một trong **4 skills**, đọc runbook và chạy MCP `ai-spector`. Thường bạn không cần gõ lệnh terminal.

**Kari Writer** chỉ sở hữu contract `.docops/` (không có agent skills). ai-spector là công cụ local tùy chọn triển khai contract qua file git.

**Cần có:** Node 20+, Git, [Cursor](https://cursor.com) và/hoặc [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Python 3.11+ *(không bắt buộc — dùng cho tìm kiếm thông minh với CocoIndex)*.

Hướng dẫn từng bước: `npm run docs:dev` hoặc `npx ai-spector course serve --open` · [Course](website/docs/vi/README.md)

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

### Bước 1 — Cài gói & khởi tạo *(CLI)*

Chạy một lần ở thư mục gốc project. **Cài gói trước**, rồi chạy wizard init.

**Registry nội bộ** (Verdaccio — **không cần** `npm login`):

```bash
npm install ai-spector --registry http://10.101.0.239:4873
npx ai-spector init
```

**npm công khai:**

```bash
npm install ai-spector
npx ai-spector init
```

Wizard init sẽ hỏi: Cursor, Claude Code hay cả hai; ngôn ngữ; git hook; CocoIndex (tùy chọn).

Sau khi chạy xong sẽ có:

- `.docops/` — contract Writer (`docops.config.json`, comments, review-queue, prototype)
- `.ai-spector/` — engine (`engine.json`, graph, registry, work sessions)
- `docs/data-source/`, `docs/srs/`, `docs/basic-design/`
- **Cursor:** `.cursor/` — **4 skills**, rules, `mcp.json`
- **Claude Code:** `CLAUDE.md` + `.claude/skills/` (4 skills) + `.mcp.json`
- Hook git trước khi commit *(nếu project có git)*

Không còn `docflow.config.json` — `init` mới tạo mô hình 2 file cấu hình.

### Cấu hình (2 file)

| File | Sở hữu | Mục đích |
|------|--------|----------|
| `.docops/docops.config.json` | **Contract Writer** (dùng chung) | Ngôn ngữ, lớp tài liệu, đường dẫn, **capabilities** |
| `.ai-spector/engine.json` | Engine ai-spector (local) | Đường dẫn graph/task, readiness, CocoIndex, `scaffoldVersion` |

**Writer** định nghĩa schema contract (`kari-writer/contracts/CONTRACT.md`). **Không** ship agent skills. **Capabilities** trong `docops.config.json` điều khiển Writer web, CLI/MCP ai-spector, skills và quy tắc `check`.

**`.docops/guide/`** dành cho người viết công cụ local — agent và skills **không** được đọc hoặc link tới thư mục này lúc chạy.

**Docops CLI** (bootstrap contract Writer):

```bash
npx ai-spector docops status
npx ai-spector docops init --lang en
npx ai-spector docops migrate --from-docflow   # tách docflow.config.json → contract + engine
npx ai-spector docops migrate --dry-run
npx ai-spector docops migrate --repair
```

Nâng cấp project còn `docflow.config.json`:

```bash
npx ai-spector docops migrate --from-docflow
npx ai-spector upgrade apply    # đồng bộ scaffold 4 skills
```

### Nâng cấp (cập nhật skills & rules)

Sau khi cài phiên bản `ai-spector` mới, refresh scaffold **4 skills** từ gói. Chỉ cập nhật skills và rules — **không** ghi đè `.ai-spector/`, graph, hay `docs/`.

```bash
npm install ai-spector@latest          # npm công khai; thêm --registry … cho Verdaccio
npx ai-spector sync-cursor             # Cursor → .cursor/skills/, .cursor/rules/
npx ai-spector sync-claude             # Claude Code → CLAUDE.md, .claude/skills/
```

Sau đó **reload MCP** (`.cursor/mcp.json` hoặc `.mcp.json`).

Trong chat: **"sync ai-spector cursor skills"** hoặc **"sync ai-spector claude skills"**.

| Lệnh | Cập nhật |
|------|----------|
| `sync-cursor` | Skills, rules, `WORKFLOW.md` trong `.cursor/` |
| `sync-claude` | `CLAUDE.md`, skills và rules trong `.claude/` |

---

### Bước 2 — Hoàn tất setup trong chat

Mở project bằng **Cursor** hoặc **Claude Code**, rồi gõ:

```text
setup ai-spector project
```

Agent sẽ cài gói npm (nếu thiếu), kiểm tra xem còn thiếu gì, hỏi bạn có muốn bật CocoIndex không, và nhắc các bước còn lại.

---

### Bước 3 — Bật skills *(làm tay một lần)*

Bật **4 skills** (không phải bộ 23 skills cũ):

| Skill | Vai trò |
|-------|---------|
| `ai-spector` | Setup, upgrade, adopt, check, work sessions |
| `ai-spector-generate` | SRS, basic/detail design, prototype, import template |
| `ai-spector-graph` | Analyze, index, validate, impact, search, sync audit |
| `ai-spector-contract` | Duyệt tài liệu, comments, prototype comments, dịch |

**Cursor**

1. Vào **Settings → Rules → Agent Skills** — bật **4** thư mục trong `.cursor/skills/`
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
add Cursor support to ai-spector
sync ai-spector cursor skills
sync ai-spector claude skills
```

Hoặc chạy `npx ai-spector sync-cursor` / `sync-claude` — xem [Nâng cấp](#nâng-cấp-cập-nhật-skills--rules) ở trên.

---

## Quy trình làm việc

Sau khi `init`, xem `.cursor/WORKFLOW.md` (Cursor) hoặc `CLAUDE.md` (Claude Code) — bản đồ **4 skills**.

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
| Xử lý comment | “resolve comments”, “show open comments” |
| Duyệt / phê duyệt tài liệu | “review documents”, “approve srs/01-overview” |
| Tạm dừng / tiếp tục work | “active work”, “resume my SRS”, “pause work” |
| Thêm / sửa một phần nhỏ | “I want to add login with Google” |
| Xem sơ đồ trực quan | “show the graph”, `npx ai-spector graph visualize --open` |
| Kiểm tra workspace | “check my workspace” |

### Quy trình thường gặp

```text
docs/data-source/  →  analyze  →  validate graph  →  generate SRS  →  index
                              →  generate basic design
                              →  prototype setup  →  generate screens (HTML hoặc SPA build)
```

---

## CLI (nếu cần)

Chủ yếu dùng chat. Một số lệnh hữu ích:

```bash
npx ai-spector course serve --open
npx ai-spector setup --check
npx ai-spector docops status
npx ai-spector docops migrate --from-docflow
npx ai-spector work list                 # work sessions (thay task)
npx ai-spector work resume <workId>
npx ai-spector contract review queue
npx ai-spector contract comments inbox
npx ai-spector graph validate
npx ai-spector graph visualize --open
```

MCP nhóm theo `work_*` và `contract_*` (review, comments, prototype, translate). Lệnh `task_*` cũ còn wrapper deprecation một phiên bản.

Đầy đủ: `npx ai-spector --help`

---

## Gặp lỗi thì làm gì

| Lỗi | Cách xử lý |
|-----|------------|
| MCP không chạy | Reload MCP; kiểm tra `.cursor/mcp.json` hoặc `.mcp.json` có server `ai-spector` |
| Setup chưa xong | Trong chat: **“check ai-spector setup”** |
| Agent không hiểu lệnh (Cursor) | Bật lại **4** thư mục skill trong `.cursor/skills/` ở Settings → Rules |
| Validate báo lỗi sau khi sửa | Trong chat: **“re-index the graph”** |
| Thiếu hook git | Trong chat: **“install ai-spector git hook”** |
| Agent bị kẹt vì lỗi CLI | Xem `.cursor/skills/ai-spector/references/cli-failures.md` |

---

## Node SDK

Dùng khi bạn viết **script, CI, hoặc backend tùy chỉnh** — cùng các thao tác typed như CLI và MCP:

- **[Hướng dẫn SDK](docs/plan/sdk.md)** — cài đặt, entry points, ví dụ, tham chiếu API

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

### Phát hành (tăng version & publish)

Version nằm trong `package.json`. Dùng script deploy — chạy test, tùy chọn bump semver, build, rồi publish.

**npm công khai:**

```bash
npm run deploy:npm
```

**Verdaccio nội bộ** (copy `.env.example` → `.env` trước):

```bash
npm run deploy
```

Script hỏi bump **patch** (mặc định), **minor**, hoặc **major**. Ghi đè bằng biến môi trường:

| Biến | Tác dụng |
|------|----------|
| `BUMP=minor` | Bump minor thay vì patch |
| `SKIP_BUMP=1` | Publish đúng version hiện tại trong `package.json` |
| `SKIP_TEST=1` | Bỏ qua `npm test` trước publish |

**Chỉ bump thủ công** (không publish):

```bash
npm version patch --no-git-tag-version   # hoặc minor | major
```

`prepublishOnly` tự chạy `npm run build` trước publish — sửa lỗi build rồi thử lại.

Script publish nằm ở **`scripts/deploy.sh`** (`npm run deploy` / `npm run deploy:npm`). Sửa file đó nếu cần đổi registry, auth, hoặc logic bump version.

**Cập nhật scaffold** (sau khi sửa `scaffold/cursor/`):

```bash
npm run build:claude-scaffold   # tạo lại scaffold/claude/ từ scaffold/cursor/
```

MIT — [LICENSE](LICENSE).
