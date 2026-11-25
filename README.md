# JobFlow

**Remote work, honestly filtered, with a resume that tells the truth.**

JobFlow is a job-discovery and resume-tailoring tool for people hunting international
remote work from Kenya — mostly students and self-taught developers without a degree.
Most job boards answer "this is remote" and stop there. JobFlow answers the two
questions that actually matter:

1. **Is this role open to me where I live?** Four geography states plus `unknown` —
   derived from the structured location *and* the posting body, with restrictions
   winning over headlines that shout "Worldwide".
2. **Does my resume cover what this posting asks for?** A measured **keyword
   coverage** figure — never called "fit", never called an "ATS score".

Then it tailors one resume to one job by **reordering and hiding — never rewriting**.
Every bullet that survives is character-identical to the bullet in your profile, and
a test asserts it.

---

## What it is not

- **Not a rewriter.** No bullet re-wording, no invented metrics, no "results-driven
  professional" voice. The engine may reorder roles and bullets, hide lines, and
  write a new opening summary from facts already in your profile. Nothing else.
- **Not a scanner-beater.** No hidden keywords, no white text, no invisible tables.
  The output is a normal `.docx` a human can read.
- **Not a PDF generator (yet).** `.docx` only in v1.0; print-to-PDF via `@media print`
  lands in v1.1.
- **Not a pitch deck.** No statistics about how many resumes are rejected by
  screening software. That number is unverifiable and the product does not need it.

---

## The product

| Route | What happens |
| --- | --- |
| `/` — Discover | Real postings from five boards, filtered to what a Nairobi applicant can actually apply to. Geography stamp, seniority tag, coverage meter. |
| `/job/[id]` | The full posting, the eligibility reasoning in plain words, the matched and missing terms, and a "Tailor my resume" action. |
| `/editor/[id]` | A plain-text editing surface for the tailored resume. No bold, no fonts, no sizes — structure lives in the model, not in formatting. Download `.docx`. |
| `/applications` | A local tracker: saved, applied, interviewing, offer, rejected — with notes and dates. |
| `/onboarding`, `/profile` | The fact base every tailored resume is built from: contact block, links, experience, projects, education, skills, and a one-line pitch. |

Three nav items only: **Discover · Applications · Profile**. Detail and editor views
are routes, not tabs, so every resume has a URL you can return to.

---

## Design decisions worth knowing

**Plain text is a feature.** The editor deliberately has no rich-text controls. If a
resume needs bold to make sense, the writing is doing the work badly. Structure
(section order, role grouping, date alignment) belongs to the model; the document
template renders it consistently.

**Geography is a first-class field, not a keyword.** Roles are classified as
`worldwide`, `africa_eligible`, `region_restricted`, `blocked`, or `unknown`. The
classifier is senior about its own honesty: "Anywhere in the World" in the title with
`Headquarters: Remote - USA` in the first body lines is **blocked**, because that is
what it is. "Indiana" is not "India". "South Africa" is not "open across Africa".
When the posting says nothing, the state is `unknown` — not a hopeful guess.

**Coverage can be `null`.** If a posting contains no recognisable terms, the meter
renders "not scored" rather than `0%`. A measured zero and an unmeasurable posting
are different facts, and the UI says so.

**Bullet hiding has a floor.** At most enough bullets are hidden to keep the resume
focused, but never below 3 per role for students and never below 2 — a role that
shows one lonely line looks like a gap, not a discipline.

**Personal data stays yours.** Authentication is Supabase anonymous sign-in;
`workspace_id` is the auth user id, and every row is guarded by row-level security.
Anonymous sessions are deleted after 30 days of inactivity (a `pg_cron` reaper
scoped to JobFlow's own profiles — the project hosts other apps' tables and nothing
outside `jobflow_*` and JobFlow's own auth users is touched).

**If anonymous sign-in is off**, the app does not fail: postings are public data and
keep loading from Supabase, while your profile, resumes and applications stay in
`localStorage` on that device. The header says `Local profile` instead of pretending
everything is synced.

---

## Data

Five sources, ingested by an Edge Function on a schedule:

| Source | Kind | Notes |
| --- | --- | --- |
| Remote OK | JSON API | Public, attribution required. |
| We Work Remotely | RSS | Per-category feeds. |
| Jobicy | JSON API | Remote-first board. |
| Himalayas | JSON API | Remote-first board. |
| Arbeitnow | JSON API | Heavy on EMEA roles. |

**Remotive is deliberately excluded** — its terms forbid redistributing postings.

Ingest is `pg_cron` → `net.http_post` → `jobflow-ingest`, four times a day
(02:07, 08:07, 14:07, 20:07 UTC). Vercel's Hobby cron cannot run sub-daily, which is
why the schedule lives in Postgres. A manual **Refresh** is available in the UI with
a 10-minute cooldown enforced server-side, and `force` is only honoured when the
request carries a valid `x-cron-secret`.

Postings are deduped on a unique `dedupe_key`, tracked with `first_seen_at` /
`last_seen_at`, deactivated after 18 hours unseen, and every run is logged to
`jobflow_ingest_runs` so the UI can show an honest **Last synced** time. The word
"live" is not used — only "Last synced", because that is the truth.

### Phase 0 finding: the market is not what job boards advertise

First real sync: **357 postings** (RemoteOK 99, WeWorkRemotely 94, Jobicy 100,
Himalayas 20, Arbeitnow 44).

- Geography: 170 blocked, 89 worldwide, 74 unknown, 16 region-restricted, 8 Africa/EMEA-eligible.
- Seniority: 193 senior, 159 mid, **5 entry**.
- Of the 97 postings plausibly open to a Nairobi applicant, **2** were entry-level.

That is the real reason a tool like this is needed. The scarcity is not in the number
of postings — it is in the number of postings that are both **eligible** and
**non-degree-friendly**. The product therefore optimises for honesty and for surfacing
the support, operations, sales-development and content roles that boards bury under
"Senior Staff Engineer", rather than for a large "junior" count it cannot deliver.

---

## Engineering notes

- **Matching** uses word-boundary regexes over escaped terms, plus an alias map
  (`javascript` ⇄ `js`, `postgres` ⇄ `postgresql`, …) and an explicit vocabulary of
  two-character terms (`go`, `r`, `qa`, `ux`, `ui`, `ml`) that a naive tokenizer
  would drop. Multi-word terms are matched as phrases.
- **Seniority** is classified senior-first, with bare "manager" excluded from the
  senior bucket — "Student Success Manager" is not a leadership role.
- **`assertEngineOutput`** runs on every `/api/tailor` response and checks the
  summary's terms, both dates of every role, project bullets, and byte-identical
  bullet text. User saves never run it: a save sets `edited_by_user` and the tail is
  then the user's own.
- **XSS:** no `dangerouslySetInnerHTML` anywhere, and a hand-written CSP in
  `next.config.mjs` (no `unsafe-eval` in production, `connect-src` limited to
  Supabase) backs that up.
- **Service-role key** lives only in the Edge Function's environment
  (`Deno.env.get`). The browser uses the publishable key; RLS does the rest.
- **Tests:** `npx vitest run` — 107 specs across matching, seniority, geography,
  tailoring invariants, docx output, CV parsing, security policy shape, and a
  full-loop over the bundled snapshot.

```
lib/        keywords · geo · tailor · cv-parse · docx · store · types
app/        Discover · job · editor · applications · profile · onboarding
components/ shell, session, discovery, editor, profile, tracker
supabase/   functions/jobflow-ingest  (RemoteOK, WWR, Jobicy, Himalayas, Arbeitnow)
tests/      table-driven acceptance specs + fixtures
```

---

## Running it

```bash
npm install
cp .env.example .env.local   # then paste your Supabase URL + publishable key
npm run dev                  # http://localhost:3000
```

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # production build
```

### Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | Publishable/anon key — safe to expose |
| `CRON_SECRET` | Edge Function secrets only | Honours `force` on manual/forced runs |

The service-role key is never in the app, never in the repo, and never in this README.

### Manual steps (a human must do these)

1. **Enable anonymous sign-in** — Supabase dashboard → Authentication → Providers →
   Anonymous. It is off by default; until it is on, the app runs in local-profile mode.
2. **Rotate the service-role key** that was exposed during development, then update the
   Edge Function secret. Nothing in this repo contains it.
3. **Set `CRON_SECRET`** on the Edge Function and in your own shell if you trigger
   forced runs by hand.

### Migrations applied

| Migration | What it does |
| --- | --- |
| `jobflow_keep_original_model` | `jobflow_resumes.original_model` + a trigger that keeps the pre-tailoring model intact |
| `jobflow_grants` | `usage` on schema `public`; `select` on public postings for `anon`; full CRUD for the service role; app tables for `authenticated` only |
| `jobflow_anonymous_guard_and_geo_default` | `geo_tier` defaults to `unknown` (not the enum's first label); postings reject client writes at the policy layer; the run log is read-only for clients |
| `jobflow_anonymous_guard_via_auth_users` | `jobflow_is_anonymous()` — a `security definer` helper that reads `auth.users.is_anonymous`, backing restrictive policies on all three personal tables |

`pg_cron` schedules: `jobflow-ingest-4x-daily` (02:07, 08:07, 14:07, 20:07 UTC) and
`jobflow-reap-anonymous` (03:15 UTC, deletes anonymous accounts untouched for 30 days,
scoped to users who have a JobFlow profile).

### Security, verified rather than assumed

The write path was exercised against the real database as a simulated session before
anonymous sign-in was switched on:

- an anonymous account can insert a profile, a resume and an application, and update
  them (including `edited_by_user`);
- a second account sees **none** of the first account's rows;
- writing a row with someone else's `workspace_id` is rejected by the row-level check;
- an `anon` (unauthenticated) request can read postings but is denied every write;
- a permanent, email-signed-in account is denied writes entirely — the workspace model
  is an anonymous-session model by design.

Postings were also read over HTTP with the publishable key exactly as the browser does
it: `200`, 357 rows, no `description` on list responses.

---

## License

Personal project, shared as-is. Postings remain the property of the boards and the
companies that published them; JobFlow links back to the original listing for every
row and never republishes a posting as its own content.
