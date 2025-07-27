## Claude Max OAuth Specification Analysis

### Key Requirements Summary
1. **OAuth 2.0 with PKCE** for Claude Max subscription users
2. **API Key fallback** for non-Max users
3. **Automatic token refresh** with 5-minute buffer
4. **Secure logout** with complete token cleanup
5. **Comprehensive error handling** with retry mechanisms
6. **Encrypted token storage** using Web Crypto API
7. **Simple UI** with dual authentication options

### Technical Architecture
- **Hook**: `useClaudeAuth` for state management
- **API Routes**: `/api/auth/claude/[url|token|refresh|validate]`
- **Components**: `ClaudeAuthButton`, `ApiKeyInput`
- **Storage**: `ClaudeTokenStore` with AES-256 encryption
- **Config**: Claude OAuth endpoints and PKCE implementation

### Implementation Tasks (10 phases)
1. Dependencies and project structure
2. Secure token storage utility
3. OAuth configuration and utilities
4. API routes for OAuth flow
5. useClaudeAuth React hook
6. UI components for authentication
7. Comprehensive error handling
8. Unit and integration tests
9. Security and performance optimizations
10. Integration and final testing

### Security Features
- HTTPS-only requests
- Encrypted localStorage with Web Crypto API
- PKCE challenge generation
- XSS protection
- Complete token cleanup on logout