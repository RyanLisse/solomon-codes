# Page snapshot

```yaml
- alert
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- img
- link "Next.js 15.3.0 (stale) Turbopack":
  - /url: https://nextjs.org/docs/messages/version-staleness
  - img
  - text: Next.js 15.3.0 (stale) Turbopack
- img
- dialog "Build Error":
  - text: Build Error
  - button "Copy Stack Trace":
    - img
  - button "No related documentation found" [disabled]:
    - img
  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools":
    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
    - img
  - paragraph: Export pkceChallenge doesn't exist in target module
  - img
  - text: ./apps/web/src/lib/auth/claude-config.ts (3:1)
  - button "Open in editor":
    - img
  - text: "Export pkceChallenge doesn't exist in target module 1 | \"use client\"; 2 | > 3 | import { pkceChallenge } from \"pkce-challenge\"; | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 4 | 5 | /** 6 | * Claude OAuth 2.0 configuration constants The export pkceChallenge was not found in module [project]/node_modules/pkce-challenge/dist/index.browser.js [app-client] (ecmascript). Did you mean to import verifyChallenge? All exports of the module are statically known (It doesn't have dynamic exports). So it's known statically that the requested export doesn't exist."
- contentinfo:
  - paragraph: This error occurred during the build process and can only be dismissed by fixing the error.
```