# Bug Reports & Support Tickets

Every signed-in user (school admin, teacher, student, parent and super admin) can report a bug from any page. Each report becomes a support ticket that the super admin manages in the ticket console.

The feature is additive. It adds new collections, routes and components. The existing changes are limited to the integration points listed at the end.

## Where things are

| Who | Where | What |
|---|---|---|
| Every school role | Floating **Report a Bug** tab on the right edge of every `/dashboard` page | Opens the **Report a Bug page** (`/dashboard/report-bug?from=<current page>`) |
| Every school role | Profile menu → **My Reported Bugs** (`/dashboard/my-bugs`) | Their own tickets: status, timeline, comments |
| Super admin | Same floating tab on super-admin pages | `/super-admin/report-bug` (filed as System Administrator) |
| Super admin | Dashboard header → **Tickets** (with unread badge) | `/super-admin/tickets` |
| Super admin | `/super-admin/tickets/[id]` | Full ticket: workflow, timeline, notes, reporter and system info |
| Super admin | `/super-admin/tickets/archive` | Solved Tickets Archive (searchable fixes) |
| Super admin | `/super-admin/tickets/settings` | Retention period and upload size limits |

## Report flow

1. The floating tab links to the report page with `?from=<the page you were on>`. That page, not the report page itself, is recorded as the ticket URL, module and page. The browser, OS, device, screen, time zone and app version are captured too. The page uses a two-column layout on desktop (the form plus a sticky sidebar showing **Reporting as**, which is just the user's name and school, and tips) and a single column on phones and tablets. The form lives in `BugReportForm`, shared by both routes.
2. As the user types a title, solved tickets with a matching title or resolution appear under **Similar issues already solved**. This helps avoid duplicates. Reporter identities are never shown.
3. Attachments upload **straight from the browser to Cloudinary** as soon as they're added, with a progress bar. Adding works by click, drag-and-drop, or pasting a screenshot. At least one image or video is required.
4. On submit, the server:
   - checks the per-user rate limit (5 reports per 15 minutes) and rejects a duplicate title sent within 10 minutes;
   - validates and sanitizes every field;
   - rebuilds the **reporter identity from the database** using the JWT. The client never supplies it. It stores only who raised the ticket (role + name), their school, and the **Teacher ID / Student ID** for those two roles. The email is stored only to notify the reporter and isn't shown on the ticket;
   - **re-verifies every attachment** with Cloudinary's Admin API: it must exist, sit in the caller's own folder, have an allowed format and be within the size limit;
   - creates `BUG-<year>-<6 digits>` from an atomic counter and records the IP, user agent, app version and a session fingerprint (a SHA-256 hash of the token, never the token itself);
   - emails the support inbox a branded HTML summary with links to the attachments and the admin panel.

### Why attachments go directly to Cloudinary

Vercel caps function request bodies at 4.5 MB, which rules out screen recordings. Instead, `POST /api/bug-reports/upload-signature` mints a signed, single-use parameter set. The signature pins the folder (`bug-reports/<role>/<userId>/`), the `public_id`, the allowed formats and, for images, compression on upload (`c_limit,w_2400,h_2400/q_auto:good`). Videos are stored as uploaded and served with `q_auto,f_auto`.

## Workflow

There are seven statuses (see `src/lib/bugReports/constants.ts`), each with its own colour. They are ordered by workflow: **Active** (Open → In Progress → Waiting for Info → Reopened), then **Completed** (Resolved → Closed → Rejected). That order is used by the status dropdown (under those two headings), the dashboard cards and the filters.

| Status | Colour | Meaning |
|---|---|---|
| Open | Blue | New ticket, not started yet |
| In Progress | Violet | Being worked on |
| Waiting for Info | Amber | Needs details or files from the reporter |
| Reopened | Orange | Came back after being resolved |
| Resolved | Green | Fixed |
| Closed | Grey | Done, no further action |
| Rejected | Red | Not a bug, duplicate or can't be reproduced |

The original 19-status workflow is migrated automatically. `migrateLegacyStatuses()` runs once per server process from the list and stats endpoints, remaps stored statuses and their status-history entries using `LEGACY_STATUS_MAP` (for example New/Acknowledged → Open, Testing/Investigation → In Progress, Duplicate → Rejected), and is idempotent. A model hook also normalizes any legacy value on save.

- **Every change adds a timeline entry:** status, priority, assignee, resolution, comments and archiving.
- **Terminal statuses** (resolved, closed, rejected) set `closedAt`, which starts the retention clock. Moving a ticket back to a non-terminal status clears it and takes the ticket out of the archive.
- **Resolved / closed** set `resolvedAt` and `resolvedBy`. Only these tickets appear in the Solved Archive and the duplicate search.
- **Assigning** an *Open* ticket moves it to *In Progress* automatically. Who it's assigned to is the `assignedTo` field, not a status.
- **Waiting for Info:** only in this state may the reporter attach files to a comment.

### Comments

| Type | Who | Visible to reporter | Notifies |
|---|---|---|---|
| Reply | Super admin | Yes | Reporter (email + in-app) |
| Internal note | Super admin | No | @mentioned team members (email) |
| Developer note | Super admin | No | @mentioned team members (email) |
| Comment | Reporter | Yes | Super admin (in-app unread) |

Mentions use the **Mention** menu, which lists the super admin team. Only mentioned ids that exist on the server are kept.

## Notifications

- **Super admin:**
  - every new ticket emails the support inbox;
  - in-app, `adminUnread` drives the red badges on the dashboard **Tickets** button and the ticket tabs, polled every 30 s;
  - while on a ticket page, a toast appears when new activity arrives.
- **Reporter:** emailed and flagged in-app (`reporterUnread`) when the status changes, the team replies, or the ticket is resolved or reopened. The floating button shows an unread count (polled every 60 s), and unread rows are marked in My Reported Bugs.

**Support inbox:** `SUPPORT_EMAIL` if set, otherwise `EMAIL_USER`, which is the account already configured for sending. No address is hard-coded. To route reports to a separate inbox, add `SUPPORT_EMAIL=...` to the environment.

## Retention & archive

- Settings → **Ticket retention**: 7 / 15 / 30 / 60 / 90 / 180 days, or Never (the default is 90).
- **Tickets are archived, not deleted.** They leave the active queue and stay in the Solved Archive. **Permanent deletion** is manual and only allowed for archived tickets. It also deletes the files from Cloudinary.
- **The sweep needs no cron.** It runs at most hourly, triggered by super admin visits to the ticket list or stats, and can be run on demand from Settings. For deployments where no admin visits for long periods, a Vercel Cron job could call the sweep instead (future work).

## Security

- **Auth:** `requireTicketUser` accepts any role's JWT; `requireSuperAdminActor` also loads the super admin and checks they're active.
- **Ownership:** reporter routes include `reporter.userId` and `reporter.role` in every query, so another user's ticket returns 404.
- **Reporter view** (`toReporterTicket`) strips internal notes, developer notes, assignment entries, IP, session and user agent.
- **Validation:** Zod schemas in `src/lib/bugReports/validation.ts`. Control characters are stripped, lengths capped, page URLs reduced to same-origin paths, and enums enforced. Output is escaped by React on screen and by `escapeHtml` in emails.
- **Rate limits** (Mongo-backed, shared across instances, see `checkRateLimit` in `src/lib/rateLimit.ts`):

  | Action | Limit |
  |---|---|
  | Create a report | 5 per 15 min |
  | Reporter comment | 30 per 15 min |
  | Upload signature | 60 per 15 min |
  | Super admin comment | 60 per 5 min |

  The existing login limiter keeps the same keys and behaviour.

## Data model

| Collection | Purpose |
|---|---|
| `bugtickets` | One document per ticket. Reporter and context snapshots, attachments, embedded timeline, unread flags. Indexed for list filters, "my tickets", retention, and a weighted text index for search |
| `ticketcounters` | `{ _id: "BUG-2026", seq }` atomic sequence |
| `ticketsettings` | Singleton `_id: "global"`: retention and upload limits |

No existing collection changes, so no migration is needed. Mongoose builds the new indexes on first use.

## API

Reporter (any signed-in role):

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/bug-reports` | My tickets (paginated) / create |
| GET | `/api/bug-reports/:id` | My ticket (reporter view); clears unread |
| POST | `/api/bug-reports/:id/comments` | Comment (+ files when the team is waiting on me) |
| POST | `/api/bug-reports/upload-signature` | Signed direct-upload parameters |
| GET | `/api/bug-reports/config` | Upload limits, app version |
| GET | `/api/bug-reports/similar?q=` | Solved tickets matching a title |
| GET | `/api/bug-reports/unread` | Count of my tickets with unseen updates |

Super admin:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/superadmin/tickets` | Table: search, filters (school, role, priority, status, category, date range, archived), sort, pagination |
| GET | `/api/superadmin/tickets/stats` | Card counts, unread, school filter options |
| GET / PATCH / DELETE | `/api/superadmin/tickets/:id` | Detail (clears unread) / status, priority, assignee, resolution / permanent delete (archived only) |
| POST | `/api/superadmin/tickets/:id/comments` | Reply, internal note or developer note, with mentions and files |
| POST | `/api/superadmin/tickets/:id/archive` | `{ archived }` manual archive / restore |
| GET | `/api/superadmin/tickets/archive` | Solved Tickets Archive search |
| GET / PUT / POST | `/api/superadmin/tickets/settings` | Read / save settings / run the retention sweep now |
| GET | `/api/superadmin/tickets/team` | Super admins, for assignment and mentions |

## Integration points in existing files

- `app/dashboard/layout.tsx`, `app/super-admin/(protected)/layout.tsx`: render `<ReportBugButton />`.
- `components/dashboard/DashboardTopBar.tsx`, `components/mobile/MobileProfileSheet.tsx`: a "My Reported Bugs" entry.
- `app/super-admin/(protected)/page.tsx`: a `<TicketsNavButton />` in the header.
- `lib/rateLimit.ts`: a general `checkRateLimit()`; `checkAuthRateLimit` now delegates to it with identical keys and limits.
- `lib/mail.ts`: `sendMail` is exported.

The app has no Redux store, so the feature follows the existing pattern: `AuthContext` and super-admin auth for identity, token-authenticated fetch helpers (`src/lib/bugReports/client.ts`), and page-local state.

## Future enhancements

- A Vercel Cron job for the retention sweep, and per-ticket SLA timers.
- Real-time updates (WebSockets or server-sent events) instead of polling.
- Feeding reporter notifications into the existing notification bell.
- A browser extension or console capture to attach JS errors automatically.
