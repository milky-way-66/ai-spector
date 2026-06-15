# Build prototype

**Phần:** [Thiết kế & prototype](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút · **Trước đó:** Basic design có danh sách màn hình

**Mục tiêu:** Chọn theme và tạo UI mockup có thể click.

---

## Chọn theme

```
help me pick a theme
```

Agent mở preview trên trình duyệt (`stripe`, `material`, `minimal`, `dark`, …). Hoặc bỏ qua:

```
generate prototype with stripe theme
```

---

## Generate

**Static HTML** *(mặc định)*:

```
generate HTML prototype
```

Mở: `npx serve prototype/` hoặc nhờ agent mở trong trình duyệt.

**SPA** *(Vue, React, …)*:

```
generate prototype with Vue
npm run build && npx ai-spector prototype sync
npx serve -s prototype/dist/
```

---

## Kiểm tra

```bash
npx ai-spector prototype validate --strict
```

---

## Phần tiếp theo

[Review & thay đổi](../06-review/README.md)
