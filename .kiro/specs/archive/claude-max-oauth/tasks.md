# Implementation Plan

- [ ] 1. Install dependencies and setup project structure
  - Install @openauthjs/openauth package for PKCE generation
  - Install crypto-js for token encryption fallback
  - Create directory structure for Claude authentication components
  - _Requirements: 1.1, 1.2, 6.4_

- [ ] 2. Implement secure token storage utility
  - [ ] 2.1 Create ClaudeTokenStore class with encryption
    - Implement AES-256 encryption for token storage using Web Crypto API
    - Add fallback to crypto-js for older browsers
    - Create methods for saveTokens, getTokens, clearTokens, and isExpired
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 2.2 Add token storage tests
    - Write unit tests for encryption/decryption functionality
    - Test token expiry checking and cleanup methods
    - Verify secure key derivation and storage isolation
    - _Requirements: 6.1, 6.5_

- [ ] 3. Create OAuth configuration and utilities
  - [ ] 3.1 Define Claude OAuth configuration constants
    - Create CLAUDE_OAUTH_CONFIG with client ID, URLs, and scopes
    - Define TypeScript interfaces for token responses and user data
    - Add error type definitions for authentication failures
    - _Requirements: 1.1, 5.1, 5.2_

  - [ ] 3.2 Implement PKCE utilities
    - Create functions for generating PKCE challenge and verifier
    - Add URL building utilities for OAuth authorization
    - Implement code parsing for authorization callback handling
    - _Requirements: 1.1, 1.2, 6.4_

- [ ] 4. Build API routes for OAuth flow
  - [ ] 4.1 Create /api/auth/claude/url endpoint
    - Generate PKCE challenge and authorization URL
    - Return secure authorization URL with proper parameters
    - Handle error cases and validation
    - _Requirements: 1.1, 1.2, 5.1_

  - [ ] 4.2 Create /api/auth/claude/token endpoint
    - Exchange authorization code for access and refresh tokens
    - Validate PKCE verifier and handle token response
    - Store tokens securely and return user data
    - _Requirements: 1.3, 1.4, 6.1_

  - [ ] 4.3 Create /api/auth/claude/refresh endpoint
    - Implement automatic token refresh functionality
    - Handle refresh token validation and new token generation
    - Update stored tokens and return new access token
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 4.4 Create /api/auth/claude/validate endpoint
    - Validate API key format and functionality
    - Test API key against Claude API endpoints
    - Return validation status and user information
    - _Requirements: 2.1, 2.2, 5.3_

- [ ] 5. Implement useClaudeAuth React hook
  - [ ] 5.1 Create core authentication state management
    - Implement authentication state with isAuthenticated, user, and authMethod
    - Add loading states and error handling
    - Create token management with automatic refresh logic
    - _Requirements: 1.5, 3.1, 3.3, 5.1_

  - [ ] 5.2 Add OAuth login functionality
    - Implement login method that initiates OAuth flow
    - Handle popup window management and authorization code collection
    - Process token exchange and update authentication state
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 5.3 Add API key authentication
    - Implement loginWithApiKey method for API key authentication
    - Validate API key and store credentials securely
    - Update authentication state for API key method
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 5.4 Add logout and token management
    - Implement logout method with complete token cleanup
    - Add getAccessToken method with automatic refresh
    - Handle token expiry and re-authentication prompts
    - _Requirements: 4.1, 4.2, 4.3, 3.4_

- [ ] 6. Create UI components for authentication
  - [ ] 6.1 Build ClaudeAuthButton component
    - Create main authentication button with dual options
    - Implement OAuth and API key authentication modes
    - Add loading states and error display
    - _Requirements: 7.1, 7.2, 7.4_

  - [ ] 6.2 Build ApiKeyInput component
    - Create secure input field for API key entry
    - Add validation and formatting guidance
    - Implement submission handling and error display
    - _Requirements: 2.1, 7.3, 7.4_

  - [ ] 6.3 Add authentication success feedback
    - Display clear success messages after authentication
    - Show user information and authentication method
    - Provide logout functionality in authenticated state
    - _Requirements: 1.5, 7.5_

- [ ] 7. Implement comprehensive error handling
  - [ ] 7.1 Add OAuth error handling
    - Handle authorization failures with clear error messages
    - Implement retry mechanisms for network errors
    - Add popup blocking detection and alternative flow
    - _Requirements: 5.1, 5.4_

  - [ ] 7.2 Add token management error handling
    - Handle token exchange failures with actionable feedback
    - Implement automatic retry for token refresh failures
    - Add graceful handling of expired refresh tokens
    - _Requirements: 5.2, 5.4, 3.2_

  - [ ] 7.3 Add API key validation error handling
    - Provide specific error messages for invalid API keys
    - Handle network errors during API key validation
    - Add retry options for validation failures
    - _Requirements: 5.3, 5.4_

- [ ] 8. Write comprehensive tests
  - [ ] 8.1 Create unit tests for useClaudeAuth hook
    - Test all authentication states and transitions
    - Mock API calls and test error handling
    - Verify token refresh and logout functionality
    - _Requirements: 1.1, 1.3, 3.1, 4.1_

  - [ ] 8.2 Create API route tests
    - Test OAuth URL generation and PKCE implementation
    - Test token exchange and refresh endpoints
    - Test API key validation endpoint
    - _Requirements: 1.1, 1.3, 2.1, 3.1_

  - [ ] 8.3 Create component tests
    - Test ClaudeAuthButton interactions and states
    - Test ApiKeyInput validation and submission
    - Test error display and loading states
    - _Requirements: 7.1, 7.2, 7.4_

- [ ] 9. Add security and performance optimizations
  - [ ] 9.1 Implement security measures
    - Add HTTPS enforcement for all authentication requests
    - Implement secure token cleanup on logout
    - Add XSS protection for token storage
    - _Requirements: 6.1, 6.3, 4.3_

  - [ ] 9.2 Add performance optimizations
    - Implement token caching to reduce API calls
    - Add request deduplication for token refresh
    - Implement proactive token refresh before expiry
    - _Requirements: 3.1, 3.4_

- [ ] 10. Integration and final testing
  - [ ] 10.1 Create integration tests
    - Test complete OAuth flow end-to-end
    - Test API key authentication flow
    - Test error recovery and retry mechanisms
    - _Requirements: 1.1, 1.3, 2.1, 5.1_

  - [ ] 10.2 Add authentication to existing pages
    - Integrate ClaudeAuthButton into main application
    - Update existing components to use Claude authentication
    - Test authentication state persistence across page reloads
    - _Requirements: 1.5, 7.1, 7.5_