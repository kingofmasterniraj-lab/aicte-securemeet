# Security baseline

Implemented in this prototype:

- bcrypt password hashing
- JWT authentication
- Helmet headers
- CORS allow-list
- JSON body size limit
- API rate limiting
- Role checks
- Input validation for core fields
- No production secrets in source

Recommended before production:

- SSO/OIDC/SAML
- MFA
- refresh-token rotation
- account lockout/risk controls
- centralized audit logging
- encrypted object storage
- signed recording URLs
- CSRF strategy if cookie auth is introduced
- TURN authentication
- dependency scanning
- SAST/DAST
- backup/restore testing
- incident response procedures
- formal privacy/legal review
