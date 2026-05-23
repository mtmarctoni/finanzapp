# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

This is a personal finance application. If you discover a security vulnerability, please report it privately before disclosing it publicly.

**Do NOT** open a public GitHub issue for security vulnerabilities.

### How to report

1. **Email**: mtmarctoni+security@gmail.com
2. **GitHub Private Vulnerability Reporting**: Go to https://github.com/mtmarctoni/finanzapp/security/advisories and click "Report a vulnerability"

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Any suggested fix (optional)

### Response timeline

- Acknowledgment: Within 48 hours
- Triage: Within 5 business days
- Fix: 1-14 days for critical issues
- Disclosure: Coordinated after fix is deployed

## Security-related configuration

The following environment variables must be set in production:

- `NEXTAUTH_SECRET` -- High-entropy random string for session encryption
- `API_KEY_PEPPER` -- HMAC key for API key hashing
- `ALLOWED_USERS` -- Comma-separated list of authorized GitHub usernames

See `.env.example` for all required variables.
