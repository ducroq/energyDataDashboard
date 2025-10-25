# Security Guidelines

## 🔒 Credentials Management

### ⚠️ IMPORTANT: Never commit secrets to Git!

This repository uses `secrets.ini` for local development credentials. This file contains sensitive information and **must never be committed to version control**.

### Setup

1. **Copy the template:**
   ```bash
   cp secrets.ini.template secrets.ini
   ```

2. **Fill in your credentials:**
   Edit `secrets.ini` with your actual API keys and passwords.

3. **Verify it's ignored:**
   ```bash
   git status
   # secrets.ini should NOT appear in the list
   ```

### What's in secrets.ini?

```ini
[api_keys]
entsoe = your_entsoe_api_key          # ENTSO-E Transparency Platform
openweather = your_openweather_key    # OpenWeather API
meteo = your_meteo_key                # Meteo API
google = your_google_api_key          # Google APIs

[security_keys]
encryption = base64_encryption_key    # AES-256 encryption key
hmac = base64_hmac_key               # HMAC-SHA256 key
```

### Environment Variables (Production)

For production (Netlify), use environment variables instead of `secrets.ini`:

**In Netlify Dashboard → Site Settings → Environment Variables:**

```bash
ENCRYPTION_KEY_B64=your_base64_encryption_key
HMAC_KEY_B64=your_base64_hmac_key
```

### Key Generation

Generate secure keys using Python:

```python
from cryptography.fernet import Fernet
import base64
import os

# Generate encryption key (32 bytes)
encryption_key = base64.b64encode(os.urandom(32)).decode()
print(f"Encryption key: {encryption_key}")

# Generate HMAC key (32 bytes)
hmac_key = base64.b64encode(os.urandom(32)).decode()
print(f"HMAC key: {hmac_key}")
```

### Security Best Practices

✅ **DO:**
- Keep `secrets.ini` local only
- Use environment variables in production
- Rotate keys periodically
- Use different keys for dev/staging/production
- Store backup keys securely (password manager, vault)

❌ **DON'T:**
- Commit secrets.ini to Git
- Share keys in plain text (email, chat)
- Use the same keys across projects
- Store keys in code comments
- Push keys to public repositories

### If You Accidentally Commit Secrets

**Act immediately:**

1. **Rotate all exposed keys:**
   - Generate new encryption/HMAC keys
   - Update Netlify environment variables
   - Update local secrets.ini

2. **Remove from Git history:**
   ```bash
   # Use git-filter-repo or BFG Repo-Cleaner
   git filter-repo --path secrets.ini --invert-paths
   ```

3. **Force push (if safe):**
   ```bash
   git push --force
   ```

4. **Invalidate compromised API keys:**
   - Revoke old keys in respective API dashboards
   - Generate new keys
   - Update configuration

### Checking for Leaks

Before pushing:

```bash
# Check for secrets in staged files
git diff --cached | grep -i "password\|secret\|key"

# Use git-secrets tool (recommended)
git secrets --scan
```

### Access Control

**Repository Access:**
- Limit who has access to the repository
- Use branch protection rules
- Require code reviews for sensitive changes
- Enable 2FA on GitHub/GitLab

**Netlify Access:**
- Limit team members with deployment access
- Use separate Netlify sites for dev/staging/prod
- Audit access logs regularly

## 🔐 Data Encryption

### How It Works

```
┌─────────────────────┐
│  Energy Data Hub    │
│  (Collect & Encrypt)│
└──────────┬──────────┘
           │
           ├─ AES-CBC-256 Encryption
           ├─ HMAC-SHA256 Signature
           │
           ▼
┌─────────────────────┐
│   GitHub Pages      │
│  (Encrypted Storage)│
└──────────┬──────────┘
           │
           ├─ HTTPS Transit
           │
           ▼
┌─────────────────────┐
│  Dashboard Build    │
│  (Decrypt & Verify) │
└─────────────────────┘
```

### Encryption Details

**Algorithm:** AES-CBC with 256-bit keys
**Integrity:** HMAC-SHA256 signatures
**Transport:** HTTPS/TLS 1.3

**Process:**
1. Data encrypted with AES-CBC-256
2. HMAC signature generated for integrity
3. Both stored together in JSON
4. Decrypted during build process
5. Signature verified before decryption

### Key Management

**Key Lifecycle:**
- **Generation:** Cryptographically secure random bytes
- **Storage:** Environment variables (Netlify)
- **Usage:** Build-time decryption only
- **Rotation:** Every 90 days recommended

## 🛡️ Security Headers

Configured in `netlify.toml`:

```toml
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
X-XSS-Protection = "1; mode=block"
Referrer-Policy = "strict-origin-when-cross-origin"
Content-Security-Policy = "default-src 'self'; ..."
```

## 🔍 Vulnerability Scanning

### Dependencies

**Check for vulnerabilities:**

```bash
# Node.js dependencies
npm audit

# Fix automatically (if possible)
npm audit fix

# Python dependencies
pip-audit
```

### Regular Updates

**Update dependencies monthly:**

```bash
# Check outdated packages
npm outdated

# Update packages
npm update

# Python packages
pip list --outdated
pip install --upgrade package_name
```

## 📊 Security Monitoring

### What to Monitor

- Unauthorized access attempts
- Unusual API usage patterns
- Failed decryption attempts
- Build failures
- Dependency vulnerabilities

### Logging

**Build logs reviewed for:**
- Decryption errors
- Invalid signatures
- Missing environment variables
- Suspicious patterns

## 🚨 Incident Response

### If Security Breach Detected

1. **Immediate Actions:**
   - Rotate all keys immediately
   - Disable compromised accounts
   - Review access logs

2. **Investigation:**
   - Identify breach scope
   - Determine data exposure
   - Document timeline

3. **Remediation:**
   - Fix vulnerabilities
   - Update security measures
   - Test thoroughly

4. **Communication:**
   - Notify affected parties if needed
   - Document lessons learned
   - Update security procedures

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Python Cryptography Library](https://cryptography.io/)
- [Netlify Security](https://www.netlify.com/security/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

---

**Last Updated:** 2025-10-25
**Security Contact:** [Add contact info]
