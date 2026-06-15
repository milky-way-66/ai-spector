# Prerequisites & init

**Phần:** [Bắt đầu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Kiểm tra môi trường, cài package, init dự án.

---

## Prerequisites

| Cần | Kiểm tra | |
|-----|----------|---|
| Node.js ≥ 20 | `node --version` | Bắt buộc |
| Git | `git --version` | Bắt buộc |
| Cursor hoặc Claude Code | mở editor | Bắt buộc |
| Python ≥ 3.11 | `python3 --version` | Tùy chọn *(semantic search)* |

Phải có Git repo:

```bash
cd /path/to/your/project
git status   # hoặc: git init && git commit -m "initial commit"
```

Chưa có `package.json`: `npm init -y`

---

## Install & init

```bash
# Registry nội bộ
npm install ai-spector --registry http://10.101.0.239:4873
npx ai-spector init

# Hoặc npm công khai
npm install ai-spector
npx ai-spector init
```

Wizard hỏi: **editor**, **languages**, **git hook** (yes), **CocoIndex** (no tạm thời).

| Tạo ra | Mục đích |
|--------|----------|
| `.ai-spector/` | Config, graph, templates |
| `docs/data-source/` | Input requirements |
| `docs/srs/`, `docs/basic-design/` | Output |
| `.cursor/` hoặc `.claude/skills/` | Skills + MCP |

---

## Check

```bash
ls .ai-spector/ docs/data-source/
ls node_modules/ai-spector
```

---

## Troubleshooting

**`npx ai-spector init` not found** — chạy `npm install ai-spector` trước.

**Lỗi registry** — kiểm tra VPN/mạng công ty, thử lại.

---

## Tiếp theo

[Setup & skills](02-setup-and-skills.md)
