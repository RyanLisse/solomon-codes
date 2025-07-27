## Claude OAuth Implementation Gaps

### Missing Components (Not in Current Implementation)

#### 1. PKCE Implementation
- **Current**: GitHub OAuth uses client secret
- **Needed**: PKCE challenge/verifier generation for Claude OAuth
- **Dependencies**: @openauthjs/openauth for PKCE utilities

#### 2. Token Refresh Mechanism
- **Current**: GitHub tokens don't expire
- **Needed**: Automatic token refresh with 5-minute buffer
- **Components**: Refresh endpoint, hook logic for auto-refresh

#### 3. Client-Side Encrypted Storage
- **Current**: Cookies only (server-readable)
- **Needed**: Encrypted localStorage using Web Crypto API
- **Components**: ClaudeTokenStore class with AES-256 encryption

#### 4. Dual Authentication Methods
- **Current**: OAuth only
- **Needed**: OAuth + API key authentication options
- **Components**: API key input component, validation endpoint

#### 5. Claude-Specific API Integration
- **Current**: GitHub API endpoints
- **Needed**: Claude/Anthropic API endpoints
- **Components**: Claude OAuth URLs, token exchange, user profile

### Reusable Components (From GitHub Implementation)

#### 1. Hook Architecture ✅
- State management pattern (isAuthenticated, user, loading, error)
- Popup-based OAuth flow
- Message passing between popup and parent

#### 2. API Route Structure ✅
- URL generation endpoint
- Callback handling
- Protected resource access patterns

#### 3. Error Handling Patterns ✅
- Consistent error states
- Network error handling
- User feedback mechanisms

#### 4. Security Practices ✅
- HTTPS enforcement
- Secure cookie configuration
- Token validation patterns

### Implementation Priority

**High Priority (Core OAuth)**:
1. PKCE implementation for secure auth flow
2. Claude API integration and endpoints
3. Token refresh mechanism
4. Encrypted client-side storage

**Medium Priority (Enhanced UX)**:
5. Dual authentication (OAuth + API key)
6. Comprehensive error handling
7. Auto-refresh with 5-minute buffer

**Low Priority (Polish)**:
8. Performance optimizations
9. Comprehensive testing
10. Security hardening

### Dependencies to Add
- @openauthjs/openauth: PKCE generation
- crypto-js: Encryption fallback for older browsers
- zod: API response validation