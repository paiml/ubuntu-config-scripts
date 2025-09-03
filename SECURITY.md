# Security Policy

## Reporting Security Vulnerabilities

We take security seriously. If you discover a security vulnerability in Ubuntu Config Scripts, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email security concerns directly to the maintainers or use GitHub's private vulnerability reporting:

1. Go to the Security tab in the repository
2. Click "Report a vulnerability"
3. Fill out the form with details

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Time

We aim to:
- Acknowledge receipt within 48 hours
- Provide an initial assessment within 1 week
- Release a fix as soon as possible

## Security Best Practices

### For Users

1. **Keep Deno Updated**: Always use the latest version of Deno
   ```bash
   deno upgrade
   ```

2. **Review Scripts**: Always review scripts before running with sudo
   ```bash
   cat scripts/system/script-name.ts
   ```

3. **Use Minimal Permissions**: Only grant sudo access to specific scripts that need it

4. **Audit Dependencies**: Regularly check for vulnerable dependencies
   ```bash
   make deps-outdated
   ```

### For Contributors

1. **Never Commit Secrets**: No API keys, passwords, or tokens in code
2. **Validate Input**: Always validate and sanitize user input
3. **Use Type Safety**: Leverage TypeScript's type system
4. **Follow Principle of Least Privilege**: Request only necessary permissions

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0   | :x:                |

## Known Security Considerations

### System Scripts
- Scripts in `scripts/system/` may require sudo access
- Always use the sudo-wrapper for privilege escalation
- NVIDIA driver scripts modify system libraries

### Audio Scripts
- PipeWire/PulseAudio configuration affects system audio
- Monitor service runs with user privileges only

### Network Operations
- OBS configuration may open network ports for streaming
- System info collector may expose system details

## Dependencies

We use automated dependency scanning via:
- GitHub Dependabot
- Deno's built-in security features
- PMAT quality gates for code analysis

## Acknowledgments

Thanks to all security researchers who responsibly disclose vulnerabilities.