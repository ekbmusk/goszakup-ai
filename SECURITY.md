# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:
- **Email**:Create an issue on GitHub (for non-critical issues)
- **Critical vulnerabilities**: Contact maintainers directly

**DO NOT** create a public GitHub issue for critical security vulnerabilities.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Best Practices

### For Deployment

1. **Never commit `.env` files** with real credentials to Git
2. **Use strong, unique tokens** for `GOSZAKUP_TOKEN` and `API_KEY`
3. **Enable rate limiting** in production (configured via environment variables)
4. **Use HTTPS** in production (recommended: Let's Encrypt for free SSL)
5. **Keep dependencies updated**: `pip install --upgrade -r requirements.txt`
6. **Run with non-root user** in Docker/production
7. **Monitor logs** for suspicious activity

### Environment Variables

```bash
# Copy the example file
cp env.example .env

# Edit .env with your real values
nano .env

# Never commit .env to Git!
```

### API Security

- **Authentication**: Set `API_KEY` in production to protect endpoints
- **CORS**: Configure `CORS_ALLOWED_ORIGINS` to restrict access
- **Rate Limiting**: Enabled by default (see middleware.py)

## Known Security Considerations

- **ML Model Storage**: This application uses `pickle` for ML model serialization. Only load models from trusted sources.
- **GraphQL Client**: Validates SSL certificates by default. Do not disable SSL verification in production.
- **In-Memory Rate Limiting**: For production, consider using Redis-based rate limiting for distributed deployments.
- **PostgreSQL**: When using database, ensure strong passwords and restricted network access.

## Security Headers

When deploying behind Nginx/reverse proxy, add these headers:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

## Audit Log

- 2026-02-23: Initial security policy created
