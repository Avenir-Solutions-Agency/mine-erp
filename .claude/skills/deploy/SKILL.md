---
name: deploy
description: Deploy this system to the test environment or to production with the project's release checklist. Use only when the user explicitly asks to deploy.
argument-hint: "<test or production>"
disable-model-invocation: true
allowed-tools:
  - Bash(git status *)
  - Bash(git log *)
  - Bash(git fetch *)
  - Bash(git tag --list *)
  - Bash(gh run list *)
  - Bash(pnpm lint)
  - Bash(pnpm typecheck)
  - Bash(pnpm test)
  - Bash(pnpm build)
---

# Deploy: $ARGUMENTS

Read `${CLAUDE_SKILL_DIR}/deploy-config.md` first: platform, method, URLs, smoke checks, rollback. If any value there is still a [placeholder], stop and ask.

## 1. Preconditions (stop on any failure)

- The target is `test` or `production`. Anything else: ask.
- The working tree is clean (`git status --porcelain` is empty).
- `test`: the commit is on `main` and the latest CI run on it is green (`gh run list --branch main --limit 1`).
- `production`: a release tag exists for the commit, CI is green on it, and pending migrations are expand–contract (forward compatible).

## 2. Quality gate

Run lint, typecheck, test and build. Any failure: stop, report, do not deploy.

## 3. Deploy

- Follow the "Deploy method" in the config.
  - `test`: CD deploys `main` automatically; only verify unless the config says otherwise.
  - `production`: a tagged release with manual approval. Prepare the tag and the release notes; creating or pushing the tag and approving the release needs my explicit "yes" in this conversation, even though the hook asks too.
- Never change secrets, DNS, Terraform state or server settings as part of a deploy.
- Never point a test deploy at the EKÁER production endpoint.

## 4. Verify

- Run the smoke checks from the config (e.g. `curl -sSf <url>/api/health`).
- Report: target, URL, commit SHA or tag, checks and their results.

## 5. If something is wrong

Report first. Offer the rollback steps from the config; run them only after I say so. If EKÁER behaves unexpectedly, recommend turning off the auto-EKÁER policy switch first.
