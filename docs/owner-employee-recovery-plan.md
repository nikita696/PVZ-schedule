# Owner / Employee recovery plan

## Why this document exists

The project already has a usable payroll and calendar core, but the access and onboarding model is inconsistent.

Main symptoms:
- owner and employee flows are mixed conceptually
- an unlinked account can be treated like owner bootstrap state
- employee invite / linking flow was removed without a complete replacement
- UI branching exists, but role resolution is not trustworthy enough

This document defines a narrow recovery plan without rewriting the whole app.

---

## What should be preserved
- payroll calculations
- shifts and payments domain logic
- current pages and UI structure where possible
- Supabase + RLS approach in general

## What must be repaired
- role resolution
- employee account linking
- invite / onboarding flow
- explicit handling for unlinked authenticated users

---

## Target access model

There are exactly three states for an authenticated user:

### 1. `owner`
- owns one workspace
- can view and modify all employees, shifts, and payments in that workspace

### 2. `employee`
- is linked to exactly one employee record
- can view only their own shifts and payments
- can create or edit only allowed pending payment entries according to policy

### 3. `unlinked`
- authenticated but not yet linked to a workspace
- cannot behave like owner
- cannot see workspace data
- should see only onboarding / invite claim UI

### Non-negotiable invariants
- an authenticated account without explicit owner or employee linkage must never be treated as owner
- an employee account must map to exactly one employee row
- owner and employee dashboards must be driven by resolved access state, not fallback assumptions
- invite removal is forbidden unless a fully working replacement exists first

---

## Recommended decision

## Option A — restore invite-code flow (recommended now)

This is the fastest recovery path because the project already had the concept.

Restore:
- `employees.invite_code`
- SQL function to generate or regenerate invite code
- SQL function for employee claim flow
- UI for owner to generate or regenerate invite
- UI for employee to enter invite code after sign-up or sign-in

### Why this is the best current move
- lowest blast radius
- minimal schema churn
- matches current `employees.auth_user_id` linking model
- gets the project back to a usable state faster than a full invitation redesign

## Option B — later replace with a dedicated invitation table

Possible future upgrade:
- `employee_invites` table
- email/token/status/expiry
- richer onboarding flow

Do **not** do this during recovery unless Option A is already stable.

---

## Recovery phases

## Phase 1 — stop access-state ambiguity

### Goal
Remove the dangerous fallback that treats an unlinked user like an owner.

### Actions
- document the three states: `owner`, `employee`, `unlinked`
- remove fallback from `unlinked` to `owner`
- return an explicit access object for unlinked users
- make UI routing depend on explicit access state

### Files to inspect first
- `app/data/appRepository.ts`
- `app/context/AppContext.tsx`
- `app/context/AuthContext.tsx`
- `app/pages/Auth.tsx`
- route guards or top-level app routing files

### Definition of done
- sign-in with an unlinked account no longer lands in owner mode
- app can render an explicit onboarding state for unlinked users

---

## Phase 2 — restore linking flow

### Goal
Allow an owner to link a real employee account again.

### SQL tasks
- restore `invite_code` column on `employees`
- restore unique index for `invite_code`
- restore `generate_invite_code()`
- restore `regenerate_employee_invite(employee_id)`
- restore `claim_employee_invite(invite_code)`
- ensure permissions are granted only to authenticated users where appropriate

### App tasks
- add repository methods for:
  - regenerate invite
  - claim invite
- translate Supabase errors for invite failures
- add owner UI to create/regenerate invite codes
- add unlinked-user UI to claim invite code

### Definition of done
- owner can generate invite code for an unlinked employee row
- employee can sign in and claim the invite
- after claim, the account resolves as `employee`

---

## Phase 3 — separate dashboard behavior by access state

### Goal
Make owner and employee UX separation explicit and reliable.

### Actions
- keep owner dashboard, employee dashboard, and unlinked onboarding as separate UI branches
- ensure employee pages never depend on owner-only controls being hidden visually; access rules must also be enforced in data/actions
- add obvious empty-state messaging for unlinked users

### Definition of done
- owner sees workspace management actions
- employee sees only self-service views
- unlinked user sees onboarding only

---

## Phase 4 — verify RLS and action permissions

### Goal
Make sure frontend assumptions match database policy reality.

### Actions
- re-check select/update/delete policies for employees, shifts, payments
- confirm employees cannot read another employee's data
- confirm unlinked authenticated users cannot read workspace data
- confirm owner-only actions are impossible for employee accounts

### Definition of done
- access is correct even if someone bypasses the UI

---

## Phase 5 — QA matrix

## Test accounts
Create and keep three test accounts:
- owner account
- linked employee account
- unlinked authenticated account

## Manual checks
### Owner
- sign in
- create employee
- generate invite code
- mark shifts
- add and confirm payments

### Employee
- sign in
- claim invite code
- see only own calendar and payments
- create pending payment entry if allowed
- cannot access owner-only actions

### Unlinked
- sign in
- sees onboarding only
- cannot access owner dashboard
- cannot access employee data

---

## Sequencing rules
- do not redesign the whole auth system during recovery
- do not rewrite payroll logic during recovery
- do not combine invite recovery with broad UI refactors
- do not remove current working pages unless a replacement is ready in the same change

---

## Minimal ticket breakdown
1. Fix access resolution for unlinked users
2. Restore invite-code schema and SQL functions
3. Add repository methods for invite generation and claim
4. Add unlinked onboarding screen
5. Add owner invite controls in employee management
6. Add QA matrix and smoke test checklist for access states

---

## Exit criteria
Recovery is complete when:
- owner, employee, and unlinked states are explicit
- no unlinked account can become owner by fallback
- invite claiming works end-to-end
- employee dashboard and owner dashboard behave differently for real reasons, not only cosmetic ones
- QA passes for all three access states
