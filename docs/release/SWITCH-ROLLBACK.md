# Switch rollback guide

If a release causes a serious problem, restore the last known-good deployment rather than attempting a hurried live repair.

1. Stop further promotion and record the failing deployment identifier.
2. Restore the previous known-good application build.
3. Do not delete or rewrite users' `switchScoreKeeper` browser data.
4. If Google sign-in is involved, disable the new client configuration or server route without invalidating unrelated sessions unless a security incident requires it.
5. Re-run the smoke checks for Rules, guided play, Modes, and saved scores against the restored version.
6. Reproduce and fix the issue on a branch, then run the full release checklist before trying again.

The current hardening work has not been deployed, so no rollback action is presently required.
