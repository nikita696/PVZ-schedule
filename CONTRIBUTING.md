# Contributing

## Local setup

```bash
npm install
npm run dev
```

## Before pushing

Run the same checks locally that CI runs in GitHub:

```bash
npm run check
```

This includes:
- typecheck
- lint
- test
- build

## Pull requests

Use small, focused PRs.

Do not mix together:
- product features
- refactors
- schema changes
- unrelated cleanup

Every PR should explain:
- what changed
- why it changed
- how to verify it manually
- what risks exist

## High-risk areas

Be extra careful in these areas:
- owner / employee access rules
- invite or account-linking flows
- Supabase schema and RLS policies
- payments, confirmations, and historical data
- import / export and backups

## Release discipline

Use the release checklist before shipping:

- [docs/release-checklist.md](docs/release-checklist.md)

## Rule of thumb

Ideas are cheap. Scope is not.

If a change is not required for the current release, put it into backlog instead of sneaking it into the current PR.
