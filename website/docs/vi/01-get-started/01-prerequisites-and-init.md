# Điều kiện tiên quyết & khởi tạo

**Phần:** [Bắt đầu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút

**Mục tiêu:** Xác nhận môi trường, cài AI Spector và scaffold dự án.

---

## Điều kiện tiên quyết

| Yêu cầu | Lệnh | Cần thiết |
|---------|------|-----------|
| Node.js ≥ 20 | `node --version` | Bắt buộc |
| Git | `git --version` | Bắt buộc |
| Cursor hoặc Claude Code | mở editor | Bắt buộc |
| Python ≥ 3.11 | `python3 --version` | Tùy chọn (semantic search sau này) |

AI Spector phải chạy trong repo Git:

```bash
cd /path/to/your/project
git status   # hoặc: git init && git commit -m "initial commit"
```

Nếu chưa có `package.json`: `npm init -y`

---

## Cài đặt & init

**Hai bước** — cài package trước, rồi chạy wizard.

**Registry nội bộ** (không cần `npm login`):

```bash
npm install ai-spector --registry http://10.101.0.239:4873
npx ai-spector init
```

**npm công khai:**

```bash
npm install ai-spector
npx ai-spector init
```

Wizard: **editor** (Cursor / Claude / cả hai), **languages**, **git hook** (yes), **CocoIndex** (no tạm thời).

| Được tạo | Mục đích |
|----------|----------|
| `.ai-spector/` | Config, graph, templates |
| `docs/data-source/` | Yêu cầu đầu vào |
| `docs/srs/`, `docs/basic-design/` | Output được tạo |
| `.cursor/` hoặc `.claude/skills/` | Agent skills + MCP |

---

## Kiểm tra

```bash
ls .ai-spector/ docs/data-source/
ls node_modules/ai-spector   # package đã cài cục bộ
```

---

## Xử lý sự cố

**`npx ai-spector init` not found**

Chạy `npm install ai-spector` trước (kèm `--registry` trên mạng nội bộ).

**Lỗi registry khi cài**

Kiểm tra VPN / mạng công ty, rồi thử lại lệnh `npm install`.

---

## Tiếp theo

[Setup trong chat & bật skills](02-setup-and-skills.md)
