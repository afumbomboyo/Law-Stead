# LAW STEAD Security Specification (Phase 0)

## 1. Data Invariants
1. **Profile Identity Isolation**: A user can only create, read, or update their own `/users/{userId}` document and `/users/{userId}/private/info` PII document. `role` is restricted to `'student'` or `'tutor'`; admin privileges cannot be self-assigned.
2. **Single-Session Lock**: `/active_sessions/{userId}` may only be read, created, updated, or deleted by `userId`, with strict `sessionId` regex and `updatedAt == request.time`. Blanket `list` is forbidden.
3. **Tutor-Only Course Authoring**: Only authenticated users whose verified `/users/{uid}` document has `role == 'tutor'` can create a `/courses/{courseId}` document, and `tutorId` must equal `request.auth.uid` and remain immutable on update.
4. **Master Gate Lesson Integrity**: Lessons under `/courses/{courseId}/lessons/{lessonId}` can only be created, updated, or deleted by the parent course's `tutorId` (verified via `get()` on `/courses/{courseId}`).
5. **Deterministic Enrollment Uniqueness**: Enrollments in `/enrollments/{enrollmentId}` require `enrollmentId == studentId + '_' + courseId`, `studentId == request.auth.uid`, immutable `purchasedAt == request.time`, and cannot be altered once created (terminal purchase record).
6. **Temporal & Volumetric Bounds**: All `createdAt`, `updatedAt`, and `purchasedAt` timestamps must match `request.time`. All IDs match `^[a-zA-Z0-9_-]+$` (`<= 128` chars), and all strings/numbers enforce explicit schema bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Profile Create**: Create `/users/victim_uid` while signed in as `attacker_uid` with `uid: "victim_uid"`. -> Expected: `PERMISSION_DENIED`.
2. **Self-Assigned Admin Role Escalation**: Create `/users/attacker_uid` with `role: "admin"` or ghost key `isAdmin: true`. -> Expected: `PERMISSION_DENIED`.
3. **PII Cross-User Read**: Signed-in user `userA` attempts `get` on `/users/userB/private/info`. -> Expected: `PERMISSION_DENIED`.
4. **Session Hijack Write**: Signed-in user `attacker` attempts to write `/active_sessions/victim_uid` to kick out `victim_uid`. -> Expected: `PERMISSION_DENIED`.
5. **Unverified Email Course Creation**: User with `email_verified: false` attempts to create a course. -> Expected: `PERMISSION_DENIED`.
6. **Student Creating Course**: Authenticated user with `role: "student"` in `/users/{uid}` attempts to create `/courses/course_1`. -> Expected: `PERMISSION_DENIED`.
7. **Shadow Field Injection on Course Update**: Tutor updates own course adding ghost field `featuredRank: 1`. -> Expected: `PERMISSION_DENIED`.
8. **Immutable Owner Tampering**: Tutor updates own course attempting to change `tutorId` or `createdAt`. -> Expected: `PERMISSION_DENIED`.
9. **ID Poisoning Attack**: Attacker attempts write to `/courses/${'A'.repeat(200)}` or `/courses/bad$id!`. -> Expected: `PERMISSION_DENIED`.
10. **Orphan/Hijacked Lesson Creation**: Tutor B attempts to add a lesson inside Tutor A's `/courses/courseA/lessons/lesson1`. -> Expected: `PERMISSION_DENIED`.
11. **Forged Enrollment for Another Student**: User A attempts to create `/enrollments/userB_course1` with `studentId: "userB"`. -> Expected: `PERMISSION_DENIED`.
12. **Timestamp Backdating & Price Tampering**: User creates enrollment with backdated `purchasedAt` (`!= request.time`) or negative `amountPaid: -50`, or attempts to mutate an existing enrollment. -> Expected: `PERMISSION_DENIED`.
