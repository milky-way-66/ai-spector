# Validate, index & explore

**Phần:** [Graph & nguồn dữ liệu](README.md) · **Khóa học:** [Trang chủ](../README.md)  
**Thời gian:** ~10 phút · **Trước đó:** [Thêm nguồn & analyze](01-sources-and-analyze.md)

**Mục tiêu:** Sửa lỗi graph, giữ index mới, và khám phá impact.

---

## Validate

```
validate the graph
```

Sửa hết **errors** trước khi generate tài liệu. **Warnings** là khoảng trống cần xem lại.

| Vấn đề | Cách sửa |
|--------|----------|
| Thiếu actors | Thêm vào nguồn → re-analyze |
| Nội dung sai dự án | Xóa file không liên quan khỏi `docs/data-source/` |

---

## Index

Sau mọi chỉnh sửa doc hoặc graph:

```
refresh the index
```

Tái tạo section registry và đồng bộ graph với tài liệu.

---

## Explore *(tùy chọn)*

**Visualize** — graph HTML tương tác:

```
show the graph
```

Hoặc: `npx ai-spector graph visualize --open`

**Impact** — cần regenerate gì sau thay đổi:

```
what's impacted by my changes
```

---

## Phần tiếp theo

[Tạo tài liệu](../04-generate/README.md)
