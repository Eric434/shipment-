# Security Specification & Threat Model

## 1. Data Invariants
- **Package Invariants**:
  - `code` must be a non-empty alphanumeric string matching `^[a-zA-Z0-9_\-]+$` and `<= 64` characters.
  - Package reads can be performed for public tracking lookups by code.
  - Package creations, modifications, and deletions must strictly require authenticated `isAdmin()` status.
  - Status transitions must obey defined enums (Order Received, Processing, In Transit, Customs Clearance, Out for Delivery, Delivered, Cancelled, On Hold).
  - Updates cannot forge or alter the immutable `code` identifier (`incoming().code == existing().code`).
- **Subscriber Invariants**:
  - Subscriber subscriptions must contain valid `email` (string, max 128 chars) and existing `code` (string, max 64 chars).
  - Subscriber records can only be read or managed by administrators or the matching email recipient.
- **Admin Invariants**:
  - `admins/{adminId}` documents define elevated authority.
  - Client users cannot grant themselves admin rights or modify admin records. Only verified admin identities (including bootstrapped `ericwalison2406@gmail.com`) can manage or claim admin role.

---

## 2. The "Dirty Dozen" Threat Payloads

1. **Payload 1 (Ghost Field Injection / Shadow Update)**: An unauthenticated or malicious user attempts to update a package with `{ "isVerified": true, "backdoor": "open" }`.
2. **Payload 2 (Unauthenticated Package Deletion)**: A random visitor attempts to delete `/packages/TSL-2026-001`.
3. **Payload 3 (Unauthenticated Package Creation)**: An unauthenticated attacker attempts to write a bogus package document with an altered destination.
4. **Payload 4 (Resource Poisoning / 1MB Payload)**: Attacker attempts to post a package with a 500KB string in `destination` or `code`.
5. **Payload 5 (Path Traversal / ID Poisoning)**: Writing to `/packages/../../../etc/passwd` with non-matching ID regex.
6. **Payload 6 (Self-Promoted Admin Role)**: An authenticated user attempts to write `{ "email": "attacker@evil.com", "role": "admin" }` to `/admins/attackerUid`.
7. **Payload 7 (Unverified Email Admin Spoofing)**: A token where `email == 'ericwalison2406@gmail.com'` but `email_verified == false` attempts administrative writes.
8. **Payload 8 (Terminal State Lock Bypass)**: Attempting to update a package that is in terminal status `Delivered` or `Cancelled` to restart delivery without admin override.
9. **Payload 9 (Subscriber PII Harvesting / Blanket Read)**: An unauthorized visitor attempting to list all subscriber emails across the entire system.
10. **Payload 10 (Invalid Status Enumeration Attack)**: Attempting to set `status: "SuperSecretHackedStatus"` violating schema enums.
11. **Payload 11 (Immutable Identifier Mutation)**: Updating `/packages/TSL-2026-001` with `code: "TSL-OVERRIDE-999"`.
12. **Payload 12 (Negative or Overflow Numeric Values)**: Submitting `speed_kph: -99999` or `shipping_cost: -500.00`.

---

## 3. Test Runner
Refer to `tests/firestore.rules.test.ts` for automated security verification enforcing `PERMISSION_DENIED` across all 12 threat attack vectors.
