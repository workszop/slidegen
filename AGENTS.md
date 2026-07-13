# Repository Instructions

## Ship Workflow

The trigger phrase for publishing completed work is **`ship it`**.

Only run this workflow when the user says `ship it` or explicitly asks to
commit, merge, and push. Do not publish changes after review-only, diagnostic,
or draft requests.

When invoked:

1. Inspect the worktree and diff. Include only changes that belong to the
   requested work; preserve unrelated user changes.
2. Run the relevant tests and validation. If verification fails, stop before
   committing or pushing and report the failure.
3. If the work is uncommitted on `main`, create a descriptive topic branch and
   commit the in-scope changes there.
4. Update local `main` from `origin/main` without rewriting history, then merge
   the topic branch into local `main` using a normal, non-destructive merge.
5. Re-run relevant verification on the merged `main` when feasible.
6. Push local `main` to `origin/main`. Pushing local `main` is the operation
   that updates remote `main`; no additional remote merge is needed.
7. Stop and ask for direction if there is a merge conflict, a non-fast-forward
   or protected-branch rejection, failing verification, or ambiguity about
   which changes to include.
8. Report the commit/merge result, pushed branch, and verification status.

Never force-push, rewrite shared history, bypass branch protection, or include
unrelated files unless the user explicitly requests it.
