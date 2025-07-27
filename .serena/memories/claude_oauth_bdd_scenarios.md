## Claude OAuth BDD Scenarios

### Feature: Claude Max OAuth Authentication

#### Scenario 1: Successful OAuth Login with Claude Max
```gherkin
Given the user has a Claude Max subscription
And the application is loaded
When the user clicks "Sign in with Claude Max"
Then the system should open a popup with Claude authorization URL
And the popup should contain PKCE challenge parameters
When the user completes authorization in the popup
And Claude redirects with authorization code
Then the system should exchange the code for access and refresh tokens
And store the tokens securely with encryption
And close the popup
And display the user as authenticated
And show the user's profile information
```

#### Scenario 2: OAuth Login with Popup Blocked
```gherkin
Given the user's browser blocks popups
When the user clicks "Sign in with Claude Max"
Then the system should detect the popup was blocked
And display an error message about popup blocking
And provide an alternative manual code entry option
When the user chooses manual entry
Then the system should open Claude auth in the same tab
And provide instructions for copying the authorization code
```

#### Scenario 3: API Key Authentication
```gherkin
Given the user does not have Claude Max subscription
When the user selects "Use API Key" option
Then the system should display a secure API key input field
And show formatting guidance for the API key
When the user enters a valid API key
And clicks submit
Then the system should validate the API key against Claude API
And store the API key securely
And mark the user as authenticated with API key method
And display authentication status clearly
```

#### Scenario 4: Invalid API Key Handling
```gherkin
Given the user is entering an API key
When the user enters an invalid API key format
Then the system should show immediate format validation error
When the user enters a properly formatted but invalid API key
And clicks submit
Then the system should attempt validation against Claude API
And display "Invalid API key" error message
And provide guidance on where to find valid API keys
And allow the user to retry
```

#### Scenario 5: Automatic Token Refresh
```gherkin
Given the user is authenticated with OAuth
And the access token expires in 4 minutes
When the system checks token expiry
Then it should automatically refresh the token using the refresh token
And update the stored tokens with new values
And continue the user session seamlessly
When the refresh token is also expired
Then the system should prompt the user to re-authenticate
```

#### Scenario 6: Token Refresh Failure
```gherkin
Given the user is authenticated with OAuth
And the access token has expired
When the system attempts to refresh the token
But the refresh request fails due to network error
Then the system should retry with exponential backoff
When all retries fail
Then the system should display a re-authentication prompt
And clear the invalid tokens from storage
```

#### Scenario 7: Secure Logout
```gherkin
Given the user is authenticated (via OAuth or API key)
When the user clicks logout
Then the system should clear all stored tokens and credentials
And revoke tokens on the server side if possible
And ensure no sensitive data remains in browser storage
And redirect to the unauthenticated state
And display logout confirmation
```

#### Scenario 8: Session Persistence
```gherkin
Given the user authenticated successfully yesterday
When the user returns to the application
Then the system should check stored tokens for validity
And automatically log the user in if tokens are valid
When stored tokens are expired but refresh token is valid
Then the system should automatically refresh and log the user in
When all tokens are expired
Then the system should show the unauthenticated state
```

#### Scenario 9: Encrypted Storage Security
```gherkin
Given the user completes OAuth authentication
When tokens are stored in the browser
Then they should be encrypted using Web Crypto API with AES-256
And the encryption key should be derived securely
And tokens should not be readable in plain text from browser storage
When the application is accessed later
Then tokens should be decrypted successfully for the same user
And fail to decrypt if storage has been tampered with
```

#### Scenario 10: Network Error Recovery
```gherkin
Given the user clicks "Sign in with Claude Max"
When the request to generate OAuth URL fails due to network error
Then the system should display a user-friendly error message
And provide a retry button
When the user clicks retry
Then the system should attempt the request again
And show loading state during retry
```

#### Scenario 11: Concurrent Token Refresh Prevention
```gherkin
Given the user has multiple tabs open with the application
And the access token expires
When multiple tabs simultaneously attempt token refresh
Then only one refresh request should be made
And all tabs should receive the updated tokens
And prevent duplicate refresh requests
```

#### Scenario 12: Authentication Method Display
```gherkin
Given the user is authenticated via OAuth
Then the system should clearly indicate "Authenticated via Claude Max"
Given the user is authenticated via API key
Then the system should clearly indicate "Authenticated via API Key"
And both should show appropriate user information
And provide logout functionality
```

### Feature: Error Handling and User Experience

#### Scenario 13: OAuth Authorization Denial
```gherkin
Given the user clicks "Sign in with Claude Max"
And the popup opens with Claude authorization
When the user denies authorization in Claude
Then Claude should redirect with error parameter
And the system should detect the authorization denial
And close the popup
And display "Authorization was cancelled" message
And return to the authentication selection screen
```

#### Scenario 14: Token Storage Corruption
```gherkin
Given the user has stored encrypted tokens
When the browser storage becomes corrupted
And the system cannot decrypt the tokens
Then it should gracefully handle the decryption failure
And clear the corrupted storage
And show the user as unauthenticated
And log the storage error for debugging
```

#### Scenario 15: API Rate Limiting
```gherkin
Given the application makes frequent API calls to validate tokens
When Claude API returns rate limiting errors
Then the system should implement exponential backoff
And show appropriate "please wait" messaging to users
And retry the request after the rate limit period
And gracefully degrade functionality if needed
```