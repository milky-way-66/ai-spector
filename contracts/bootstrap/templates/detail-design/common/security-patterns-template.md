# Security Patterns: <Project Name>

> This document defines common security patterns, authentication mechanisms, authorization strategies, and security standards used across all features.

**Source Requirements:** SRS Section 7.3 (Security Requirements)

---

## 1. Overview

**Purpose:**
> This document establishes security patterns and standards that should be followed by all features to ensure consistent security implementation across the system.

**Security Principles:**
- Defense in depth
- Least privilege
- Secure by default
- Fail securely
- Security through obscurity is not security

---

## 2. Authentication

**Authentication Method:** <JWT/OAuth2/Session-based>

### 2.1 JWT Authentication (Example)

**Token Structure:**
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "email": "user@example.com",
    "roles": ["user", "admin"],
    "iat": 1234567890,
    "exp": 1234571490
  }
}
```

**Token Lifecycle:**
1. User authenticates with credentials
2. System validates credentials
3. System generates JWT access token (short-lived) and refresh token (long-lived)
4. Client stores tokens securely
5. Client includes access token in Authorization header
6. When access token expires, client uses refresh token to obtain new access token

**Token Storage:**
- **Access Token:** <In-memory/HttpOnly cookie>
- **Refresh Token:** <HttpOnly cookie/Secure storage>

**Token Expiration:**
- Access Token: <Duration, e.g., 15 minutes>
- Refresh Token: <Duration, e.g., 7 days>

### 2.2 OAuth2 Authentication (Alternative)

**Flow Type:** <Authorization Code Flow/Client Credentials>

**OAuth2 Providers:**
- <Provider 1>: <Purpose>
- <Provider 2>: <Purpose>

**Implementation:**
> Describe OAuth2 implementation if used

### 2.3 Session-Based Authentication (Alternative)

**Session Management:**
- Session Storage: <Redis/Database>
- Session Expiration: <Duration>
- Session Security: <CSRF protection, secure cookies>

---

## 3. Authorization

**Authorization Model:** <RBAC/ABAC/Attribute-based>

### 3.1 Role-Based Access Control (RBAC)

**Roles:**
| Role | Permissions | Description |
|------|-------------|-------------|
| Admin | <All permissions> | Full system access |
| Manager | <Subset of permissions> | Department/team management |
| User | <Limited permissions> | Basic user operations |

**Role Hierarchy:**
```
Admin
  └── Manager
      └── User
```

**Permission Model:**
- **Resource:** <Entity, e.g., Employee, Document>
- **Action:** <Operation, e.g., Create, Read, Update, Delete>
- **Permission Format:** `<resource>:<action>`, e.g., `employee:create`

### 3.2 Attribute-Based Access Control (ABAC)

**Attributes:**
- User attributes: <Role, Department, Location>
- Resource attributes: <Owner, Department, Classification>
- Environment attributes: <Time, IP Address, Device>

**Policy Examples:**
- Users can only access resources in their department
- Managers can approve requests during business hours
- Admins can access all resources regardless of location

### 3.3 Authorization Implementation

**Middleware Pattern:**
```javascript
// Example authorization middleware
function authorize(permission) {
  return (req, res, next) => {
    if (userHasPermission(req.user, permission)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
}
```

**Usage:**
- Apply at API endpoint level
- Apply at feature/component level
- Apply at data access level

---

## 4. Data Protection

### 4.1 Encryption

**Encryption at Rest:**
- Database: <Encryption method, e.g., AES-256>
- File Storage: <Encryption method>
- Backup Storage: <Encryption method>

**Encryption in Transit:**
- Protocol: <TLS 1.2+>
- Certificate Management: <Approach>
- Certificate Rotation: <Strategy>

**Sensitive Data Encryption:**
- Fields to encrypt: <PII, passwords, payment info>
- Encryption Algorithm: <AES-256>
- Key Management: <AWS KMS/HashiCorp Vault>

### 4.2 Data Masking

**Masking Rules:**
- Email: <Show first 3 characters, mask rest>
- Phone: <Show last 4 digits, mask rest>
- Credit Card: <Show last 4 digits, mask rest>

**When to Apply:**
- Logging sensitive data
- Displaying data in UI
- Sharing data with third parties

### 4.3 Password Security

**Password Requirements:**
- Minimum Length: <8-12 characters>
- Complexity: <Uppercase, lowercase, numbers, special characters>
- Password History: <Prevent reuse of last N passwords>
- Expiration: <90 days or never>

**Password Storage:**
- Hashing Algorithm: <bcrypt/Argon2>
- Salt: <Random salt per password>
- Never store plain text passwords

---

## 5. Input Validation

### 5.1 Validation Rules

**Validation Layers:**
1. **Client-side:** Immediate feedback, better UX
2. **API Gateway:** First line of defense
3. **Application:** Business logic validation
4. **Database:** Data integrity constraints

**Common Validations:**
- **Length:** Min/max length constraints
- **Format:** Email, phone, URL patterns
- **Type:** String, number, date validation
- **Range:** Numeric range validation
- **Sanitization:** Remove/escape dangerous characters

### 5.2 SQL Injection Prevention

**Prevention Methods:**
- Use parameterized queries/prepared statements
- Never concatenate user input into SQL queries
- Use ORM/query builders with parameter binding
- Validate and sanitize all inputs

### 5.3 XSS Prevention

**Prevention Methods:**
- Escape user input before rendering
- Use Content Security Policy (CSP)
- Validate and sanitize HTML input
- Use framework's built-in XSS protection

### 5.4 CSRF Prevention

**Prevention Methods:**
- Use CSRF tokens
- SameSite cookie attribute
- Verify origin/referer headers
- Use framework's CSRF protection

---

## 6. Security Headers

**Required HTTP Headers:**

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | <Policy> | Prevents XSS attacks |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Strict-Transport-Security` | `max-age=31536000` | Enforces HTTPS |
| `X-XSS-Protection` | `1; mode=block` | XSS protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer info |

---

## 7. Security Logging and Monitoring

### 7.1 Security Events to Log

**Authentication Events:**
- Login attempts (successful and failed)
- Logout events
- Token refresh
- Password reset requests

**Authorization Events:**
- Permission denied attempts
- Role changes
- Access to sensitive resources

**Security Violations:**
- Failed authentication attempts
- Unauthorized access attempts
- Suspicious activity patterns
- Data access violations

### 7.2 Log Format

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "event_type": "authentication_failed",
  "user_id": "user123",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "details": {
    "reason": "invalid_password"
  }
}
```

### 7.3 Monitoring and Alerting

**Alerts:**
- Multiple failed login attempts from same IP
- Unusual access patterns
- Privilege escalation attempts
- Data exfiltration attempts

**Monitoring Tools:**
- <SIEM tool>
- <Security monitoring platform>
- <Log aggregation tool>

---

## 8. API Security

### 8.1 API Authentication

**Methods:**
- Bearer Token (JWT)
- API Key (for service-to-service)
- OAuth2 Client Credentials

### 8.2 Rate Limiting

**Limits:**
- Per IP: <X requests per minute>
- Per User: <X requests per minute>
- Per API Key: <X requests per minute>

**Implementation:**
- Use rate limiting middleware
- Return appropriate HTTP status (429 Too Many Requests)
- Include retry-after header

### 8.3 API Versioning

**Versioning Strategy:**
- URL path: `/api/v1/`, `/api/v2/`
- Header: `Accept: application/vnd.api+json;version=1`

**Deprecation:**
- Announce deprecation 6 months in advance
- Maintain backward compatibility during transition
- Provide migration guide

---

## 9. Secure Development Practices

**Code Review Checklist:**
- [ ] Input validation implemented
- [ ] Authentication and authorization checked
- [ ] Sensitive data encrypted
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Security headers set
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't expose sensitive data

**Dependency Management:**
- Regularly update dependencies
- Scan for known vulnerabilities
- Use dependency scanning tools
- Keep security patches up to date

---

## 10. Compliance and Standards

**Compliance Requirements:**
- <GDPR/PCI-DSS/HIPAA/SOC 2>

**Security Standards:**
- OWASP Top 10 compliance
- CWE Top 25 awareness
- Industry-specific standards

**Audit and Compliance:**
- Regular security audits
- Penetration testing
- Vulnerability assessments
- Compliance reporting

---

## 11. References

**Related Documents:**
- [Architecture Overview](../common/architecture-overview-template.md)
- [Error Handling Patterns](../common/error-handling-patterns-template.md)
- [Feature Detail Design Template](../feature-detail-design-template.md)

**SRS References:**
- SRS Section 7.3: Security Requirements

**External Resources:**
- OWASP Top 10: <Link>
- OWASP API Security Top 10: <Link>
- Security Best Practices: <Link>

---

## 12. Notes

**Security Considerations:**
- <Consideration 1>
- <Consideration 2>

**Future Enhancements:**
- <Enhancement 1>
- <Enhancement 2>
