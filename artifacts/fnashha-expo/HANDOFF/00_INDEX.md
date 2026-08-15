# Fnashha Expo — HANDOFF Knowledge Base Index

> **For future Agents:** Read this file first. It tells you exactly which file to open for any task. Do not explore the project from scratch — use this folder instead.

---

## How to Use This Knowledge Base

1. **Read this index first** to find the right file for your task.
2. **Open only the files relevant to your task** — do not read all 19 files.
3. **Update the relevant file(s) before ending your session** — keep the knowledge base current.
4. **Never delete information** — append new knowledge; mark old knowledge as superseded if needed.

---

## File Directory

| File | Topic | Open When… |
|---|---|---|
| `00_INDEX.md` | This index | Always read first |
| `01_PROJECT_OVERVIEW.md` | Tech stack, architecture, monorepo context | Starting a new session, understanding the project scope |
| `02_FOLDER_STRUCTURE.md` | Full annotated file tree | Looking for a file, adding a new screen or component |
| `03_NAVIGATION.md` | Expo Router routes, auth gate, tab structure, deep links | Adding a screen, fixing navigation, understanding routing |
| `04_AUTHENTICATION.md` | JWT, token refresh, AuthContext, roles, login/logout flow | Auth issues, role-gating, token expiry, user shape |
| `05_API_ENDPOINTS.md` | All backend endpoints, request/response shapes | Calling the API, adding a new endpoint consumer |
| `06_REQUEST_LIFECYCLE.md` | Status machine, what each status means, who can act | Working on request detail, status transitions, permissions |
| `07_OFFERS_AND_WORKFLOW.md` | Offer submission, selection, price change, completion | Technician offer flow, price adjustments, job completion |
| `08_WALLET_AND_POINTS.md` | Points balance, transactions, loyalty wallet, dark mode | Technician wallet, customer loyalty, coin rewards |
| `09_CHAT_AND_NOTIFICATIONS.md` | SSE real-time, messaging, push notifications, routing | Chat screen, notifications, real-time updates |
| `10_PROFILE_AND_UPLOADS.md` | Edit profile, image upload, Blob approach, MIME types | Profile editing, photo uploads, HEIC/WebP issues |
| `11_UI_DESIGN_RULES.md` | Android white rectangle, elevation, theming, fonts | Styling components, elevation/shadow issues, dark mode |
| `12_RTL_GUIDE.md` | RTL layout rules, `direction:'rtl'`, flex row ordering | Arabic layout, adding new screens, fixing LTR rendering |
| `13_BUILD_AND_RELEASE.md` | Dev server, APK, iOS, env vars, Expo Go | Building, releasing, environment configuration |
| `14_KNOWN_BUGS.md` | Pre-existing TypeScript errors, open issues | Debugging, understanding baseline noise |
| `15_COMPLETED_FIXES.md` | All verified fixes with code locations | Understanding what was already done, avoiding regressions |
| `16_PENDING_TASKS.md` | Future work, backlog, improvement ideas | Planning next session, picking up outstanding work |
| `17_CHANGELOG.md` | Session-by-session history of changes | Understanding what changed and when |
| `18_AGENT_NOTES.md` | Tricky gotchas, non-obvious decisions, anti-patterns | Before making any significant change |

---

## Quick Task → File Map

| Task | Files to Read |
|---|---|
| Add a new screen | `03_NAVIGATION.md`, `02_FOLDER_STRUCTURE.md`, `12_RTL_GUIDE.md` |
| Fix a navigation bug | `03_NAVIGATION.md`, `04_AUTHENTICATION.md` |
| Call a new API endpoint | `05_API_ENDPOINTS.md`, `04_AUTHENTICATION.md` |
| Work on request flow | `06_REQUEST_LIFECYCLE.md`, `07_OFFERS_AND_WORKFLOW.md` |
| Work on wallet/points | `08_WALLET_AND_POINTS.md` |
| Work on chat or notifications | `09_CHAT_AND_NOTIFICATIONS.md` |
| Work on file upload | `10_PROFILE_AND_UPLOADS.md` |
| Fix a styling or layout bug | `11_UI_DESIGN_RULES.md`, `12_RTL_GUIDE.md` |
| Fix an RTL/Arabic layout issue | `12_RTL_GUIDE.md` |
| Build or deploy | `13_BUILD_AND_RELEASE.md` |
| Debug a TypeScript error | `14_KNOWN_BUGS.md` |
| Check what was already fixed | `15_COMPLETED_FIXES.md` |
| Plan new features | `16_PENDING_TASKS.md` |
| Understand previous sessions | `17_CHANGELOG.md` |
| Make any non-trivial change | `18_AGENT_NOTES.md` |

---

## Maintenance Rule

> Before ending any coding session, update the files that correspond to what you changed. At minimum:
> - Append to `17_CHANGELOG.md`
> - Append to `15_COMPLETED_FIXES.md` if you fixed bugs
> - Update `16_PENDING_TASKS.md` if work is outstanding
> - Update the specific topic file (e.g. `12_RTL_GUIDE.md`) if you changed something architectural

---

*Last updated: July 2026*
