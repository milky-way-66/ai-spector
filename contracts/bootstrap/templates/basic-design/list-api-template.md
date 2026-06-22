# API List: 

> This document provides the API overview, authentication, and a summary list of all endpoints. For detailed request/response specifications per endpoint, see the Detail API document.

**Source Requirements:** SRS Section 4 (System Features), Section 6.2 (Software Interfaces)

---

## 1. API Overview

**Base URL:** `<https://api.example.com/v1>`

**API Version:** `v1.0`

**Protocol:** `HTTPS`

**Authentication:** <JWT/OAuth2/API Key>

**Content Type:** `application/json`

**Source Requirements:**

- SRS Section 4: 
- SRS Section 6.2: 
- SRS Section 7.3: 

---

## 2. Authentication

**Method:** <JWT Bearer Token / OAuth2 / API Key>

**How to Authenticate:**

> Describe the authentication flow.

**Token Format:**

> Describe token structure if applicable.

**Example:**

```http
Authorization: Bearer <token>
```

**Token Expiration:**

> Describe token expiration and refresh mechanism.

---

## 3. Endpoint Summary


| Method   | Endpoint         | Description | Authentication |
| -------- | ---------------- | ----------- | -------------- |
| `POST`   | `/resource`      |             | Required       |
| `GET`    | `/resource`      |             | Required       |
| `GET`    | `/resource/{id}` |             | Required       |
| `PUT`    | `/resource/{id}` |             | Required       |
| `DELETE` | `/resource/{id}` |             | Required       |


> Add one row per endpoint. For detailed specifications (request/response schemas, path/query params), see the Detail API document.

---

## 4. Pagination

**Query Parameters:**

- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 20, max: 100)

**Response Format:**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

---

## 5. Filtering and Sorting

**Query Parameters:**

- `filter[field]`: Filter by field value
- `sort`: Sort field and direction (e.g., `created_at:desc`)

**Examples:**

```
GET /resource?filter[status]=active&sort=created_at:desc
```

---

## 6. OpenAPI / Specification Reference

> Reference or include link to OpenAPI/Swagger specification file.

**Location:** `<api-spec.yaml>`

**Note:** For detailed endpoint specifications, see the Detail API document.

---

## 7. Notes

**API Versioning Strategy:**

> Describe versioning approach.

**Deprecation Policy:**

> Describe how deprecated endpoints are handled.

**Testing:**

> Reference API testing documentation or Postman collection.

