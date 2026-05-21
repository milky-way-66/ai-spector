# Detail Design: Feature List

> This document lists all features that have (or will have) a detail design. Each feature links to its **detail design document**, where component design, sequence diagrams, API specs, database schema, UI design, and implementation details are specified.
>
> **Structure:** (1) This file — index of all features with links; (2) **One file per feature** (e.g. in `features/` or alongside this file), each created from the [Feature Detail Design Template](feature-detail-design-template.md).

**Related Documents:**
- [Architecture Overview](common/architecture-overview-template.md)
- [Security Patterns](common/security-patterns-template.md)
- [Error Handling Patterns](common/error-handling-patterns-template.md)
- [Performance Standards](common/performance-standards-template.md)
- [Integration Patterns](common/integration-patterns-template.md)
- [Deployment & Infrastructure](common/deployment-infrastructure-template.md)
- [Feature Detail Design Template](feature-detail-design-template.md) — template for each feature’s detail doc
- [Basic Design - API Design](../../basic_design/api-design-template.md)
- [Basic Design - Database Design](../../basic_design/db-design-template.md)
- [Basic Design - Mockup Screens](../../basic_design/mockup-screens-template.md)

---

## 1. List of Features

| Feature ID | Feature Name | SRS Reference | Priority | Status |
|------------|--------------|----------------|----------|--------|
| F-01 | <Feature Name> | SRS Section 4.1 | High/Medium/Low | Draft/Approved |
| F-02 | <Feature Name> | SRS Section 4.2 | High/Medium/Low | Draft/Approved |

**Conventions:**
- **Feature ID:** Matches SRS system feature ID (e.g. F-01, F-02) or your project’s ID scheme.

---

## 2. Feature Dependencies (Optional)

> Document which features depend on others for implementation or integration.

| Feature | Depends On | Description |
|---------|------------|-------------|
| F-02 | F-01 | <e.g. F-02 uses APIs/data from F-01> |
