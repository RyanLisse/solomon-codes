## GitHub OAuth Implementation Patterns (Reusable for Claude OAuth)

### Architecture Pattern
```
useGitHubAuth Hook → API Routes → GitHubAuth Class → External OAuth Server
```

### Key Components

#### 1. React Hook (useGitHubAuth)
- **State Management**: isAuthenticated, user, loading, error states
- **Cookie-based authentication** check on mount
- **Popup-based OAuth flow** with message passing
- **Token validation** via API calls
- **Auto-cleanup** on logout

#### 2. API Routes Structure
- `/api/auth/github/url` - Generate OAuth URL
- `/api/auth/github/callback` - Handle OAuth callback
- `/api/auth/github/repositories` - Protected resource access

#### 3. OAuth Class (GitHubAuth)
- **Environment-based config** (CLIENT_ID, CLIENT_SECRET)
- **URL generation** with proper scopes and redirect URI
- **Token exchange** implementation
- **User info fetching**
- **Protected API calls**

#### 4. Security Patterns
- **HttpOnly cookies** for access tokens
- **Readable cookies** for user info
- **HTTPS enforcement** in production
- **State parameter** for CSRF protection
- **Token validation** on each protected request

### Key Reusable Patterns for Claude OAuth

1. **Popup Flow**: Open OAuth in popup, listen for messages
2. **Cookie Strategy**: HttpOnly for tokens, readable for user data
3. **Hook Structure**: Same state management pattern
4. **API Route Structure**: Similar endpoint organization
5. **Error Handling**: Consistent error states and messaging
6. **Auto-validation**: Check token validity on mount

### Differences for Claude OAuth
- **PKCE Implementation**: Need PKCE instead of client secret
- **Token Refresh**: GitHub tokens don't expire, Claude tokens do
- **Dual Auth**: Need both OAuth and API key support
- **Encrypted Storage**: Claude spec requires client-side encryption