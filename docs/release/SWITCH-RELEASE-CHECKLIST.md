# Switch release checklist

Use this checklist before any production release.

- Confirm the change is being released from the intended Switch branch and repository.
- Run `npm run check:runtime` and do not continue if a protected runtime file differs.
- Run `npm run build`, `npm run test:sites`, and the full Playwright suite.
- Confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and `.openai/hosting.json` exist.
- Check Rules, Cards, Modes, Questions, the guided game, and the scorekeeper on iPhone and Pixel 10.
- Test an upgrade with a copy of existing `switchScoreKeeper` data; never clear live browser storage as part of a release.
- If enabling Google sign-in, configure only real production origins, verify ID tokens server-side, use secure HTTP-only session cookies, and test sign-out.
- Confirm demo advertising remains labelled as a demonstration and no live ad or payment flow has appeared unexpectedly.
- Record the previous production version before promotion.
- Obtain explicit approval before deploying or promoting to production.
