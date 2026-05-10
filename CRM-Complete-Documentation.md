# Style Lounge CRM — Complete Documentation
### Every detail about the system, architecture, logic, and deployment

---

## Table of Contents

1. [What is this CRM?](#1-what-is-this-crm)
2. [Technology Stack](#2-technology-stack)
3. [Database — Neon PostgreSQL](#3-database--neon-postgresql)
4. [Deployment — Vercel](#4-deployment--vercel)
5. [Authentication & User Roles](#5-authentication--user-roles)
6. [Database Schema — Every Table Explained](#6-database-schema--every-table-explained)
7. [Core Business Logic — Followups](#7-core-business-logic--followups)
8. [Pages & Features](#8-pages--features)
9. [Import System](#9-import-system)
10. [Data Normalization Logic](#10-data-normalization-logic)
11. [Profile & Photo System](#11-profile--photo-system)
12. [Admin Features](#12-admin-features)
13. [Agent Features](#13-agent-features)
14. [Super Admin](#14-super-admin)
15. [How Everything Connects](#15-how-everything-connects)
16. [Deployment Step-by-Step](#16-deployment-step-by-step)
17. [Environment Variables](#17-environment-variables)
18. [Vercel Limits & Constraints](#18-vercel-limits--constraints)
19. [Known Behaviours & Edge Cases](#19-known-behaviours--edge-cases)

---

## 1. What is this CRM?

This is a custom-built Customer Relationship Management system built specifically for **Style Lounge**, a salon business. It was built to replace a shared Google Spreadsheet that the team was using to track customer followups.

**Core purpose:** Help a team of sales agents manage and follow up with thousands of customers who have registered or booked at Style Lounge salons. Each agent owns a set of customers and is responsible for calling them, logging remarks, and scheduling the next followup date.

**Built with:** Next.js 16 (React 19), Prisma ORM, PostgreSQL (Neon), NextAuth v5, Tailwind CSS, deployed on Vercel.

---

## 2. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 16 (App Router) | Server-side rendering, fast page loads |
| UI Styling | Tailwind CSS v4 | Utility-first, fast to build |
| Icons | Heroicons v2 | Clean outline icons |
| Database ORM | Prisma v6 | Type-safe DB queries, migrations |
| Database | PostgreSQL (via Neon) | Reliable relational DB, free tier |
| Authentication | NextAuth v5 (beta) | JWT sessions, credentials login |
| Password Hashing | bcryptjs | Secure password storage |
| File Parsing | xlsx (SheetJS) | Read CSV and Excel files |
| Hosting | Vercel (Hobby free tier) | Zero-config Next.js deployment |
| Language | TypeScript | Type safety across the full stack |

---

## 3. Database — Neon PostgreSQL

### What is Neon?

Neon is a **serverless PostgreSQL** provider. "Serverless" means:
- The database **scales to zero** when not in use — it literally shuts down after a few minutes of inactivity
- When the first request comes in after being idle, Neon **wakes up** (cold start, takes 1-3 seconds)
- You pay only for what you use — the free tier gives you enough for a small team

### How Neon differs from a normal database

A regular database (like on a VPS) runs 24/7. Neon turns off when idle. This means:
- First request after idle = slightly slow (waking up)
- Once awake, it performs like a normal PostgreSQL database
- Connection string looks like: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`

### Our Neon setup

- **Provider:** ap-southeast-1 (Singapore region — closest to India)
- **Database name:** neondb
- **Connection pooling:** Neon provides a built-in connection pooler (PgBouncer) which is critical for serverless environments where many short-lived functions try to connect simultaneously

### Why we use Neon

- Free tier is permanent (no trial expiry)
- Automatic backups
- Works perfectly with Vercel serverless functions
- No server to manage

### Connecting to Neon

The connection string is stored in the `DATABASE_URL` environment variable. Prisma uses this to connect. In production (Vercel), this variable is set in Vercel's project settings. Locally, it is in the `.env` file.

---

## 4. Deployment — Vercel

### What is Vercel?

Vercel is a cloud platform that hosts Next.js applications. When you push code to GitHub, Vercel automatically builds and deploys it. There is no server to manage.

### How Vercel works (simplified)

1. You push code to GitHub
2. Vercel detects the push automatically
3. Vercel runs `npm run build` (Next.js build)
4. The app is deployed globally on Vercel's edge network
5. Live in ~1-2 minutes

### Serverless Functions

Every API route in Next.js (`src/app/api/...`) becomes a **serverless function** on Vercel. This means:
- Each API call spins up a fresh container, runs the code, and shuts down
- There is **no persistent memory** between requests
- There is **no persistent filesystem** — you cannot save files to disk
- Each function has a **maximum execution time of 60 seconds** on the Hobby (free) plan

This is why all data (including profile photos) must be stored in the database, not on disk.

### Our Vercel setup

- **Plan:** Hobby (free)
- **GitHub repo:** `CRM-2.0` (the one Vercel watches for auto-deploys)
- **Domain:** `crm-2-0-nu.vercel.app`
- **Region:** Automatically selected (closest to users)
- **Build command:** `prisma generate && next build` (Vercel runs this automatically)

### Two GitHub repos

There are two GitHub repositories:
- `crm` — the original development repo (push with `git push origin main`)
- `CRM-2.0` — the repo connected to Vercel (push with `git push crm2 main`)

**Important:** Always push to BOTH repos. Only `CRM-2.0` triggers Vercel deployments.

---

## 5. Authentication & User Roles

### How login works

Authentication uses **NextAuth v5** with a **JWT (JSON Web Token) strategy**.

1. User enters email and password on `/login`
2. NextAuth calls the `authorize()` function in `src/auth.ts`
3. If credentials are valid, a **JWT token** is created and stored in a browser cookie
4. Every page load and API call reads this cookie to know who is logged in
5. The session lasts **30 days** before requiring re-login

### What is a JWT?

A JWT is an encrypted token stored in the browser cookie. It contains:
- `uid` — the user's database ID
- `role` — ADMIN or AGENT
- `name` — the user's display name
- `photoUpdatedAt` — a Unix timestamp used to cache-bust the profile photo

The token is **signed with a secret key** (`AUTH_SECRET` environment variable). This means it cannot be tampered with — if anyone modifies the cookie, the signature breaks and the session is rejected.

**Important:** The actual photo image is NOT stored in the JWT — only a timestamp. Storing a base64 image in the JWT caused HTTP 431 (Request Header Too Large) errors because cookies have size limits.

### Password Storage

Passwords are **never stored in plain text**. They are hashed using `bcryptjs`:
- When creating an agent: `bcrypt.hash(password, 10)` — creates an irreversible hash
- When logging in: `bcrypt.compare(enteredPassword, storedHash)` — verifies without revealing the original

### User Roles

There are three levels of access:

| Role | Who | Access |
|------|-----|--------|
| Super Admin | Owner/developer | Everything — manages admins, hidden from team |
| Admin | Manager (e.g., Deepak Sir) | Everything except Super Admin panel |
| Agent | Sales team (Sonia, Lakshita, Shivani, Soumya) | Their own customers only |

### Super Admin (Special)

The Super Admin is **not stored in the database**. It exists only in environment variables:
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

This means:
- Super Admin cannot be deleted by accident
- Super Admin's ID is hardcoded as the string `"super-admin"` (not a database ID)
- Because it is not in the database, certain FK (foreign key) operations use the real admin's database ID as a fallback
- Super Admin has no Profile page (hidden in the sidebar)

### Session Re-sync

When an agent updates their name or photo, the JWT in their browser is stale (still has the old data). The system handles this with:
1. After saving, the client calls `update()` from NextAuth — this triggers `trigger: "update"` in the JWT callback
2. The JWT callback re-fetches `name` and `updatedAt` from the database and updates the token
3. The browser cookie is refreshed with the new data

---

## 6. Database Schema — Every Table Explained

The database has 10 tables. Here is every table with every field explained.

---

### Table: `User`

Stores all team members (admins and agents). Super Admin is NOT in this table.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID, auto-generated |
| email | String (unique) | Login email |
| name | String | Display name shown everywhere |
| passwordHash | String | bcrypt hash of password |
| role | Enum (ADMIN/AGENT) | Controls what they can access |
| isActive | Boolean | False = cannot log in |
| onLeaveFrom | DateTime? | If set, agent is on leave |
| onLeaveUntil | DateTime? | When leave ends |
| profilePhoto | String? | Base64 encoded photo stored in DB |
| createdAt | DateTime | When account was created |
| updatedAt | DateTime | Last time any field changed (auto-managed by Prisma) |
| deletedAt | DateTime? | Soft delete — set when agent is removed |

**Soft delete:** Agents are never truly deleted. Their `deletedAt` is set, which hides them everywhere but preserves all their history and customer assignments.

---

### Table: `Customer`

The central table. One row per customer, keyed by phone number.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| phone | String (unique) | 10-digit normalized phone — the master key |
| name | String? | Customer's name |
| gender | String? | Gender |
| address | String? | Full address |
| city | String? | City |
| sector | String? | Sector/area |
| customerIdExt | String? | External ID from your registration spreadsheet |
| customerType | Enum | NEW_REGISTRATION or CUSTOMER |
| ownerId | String? | FK to User — which agent owns this customer |
| doNotContact | Boolean | If true, customer is DNC — excluded from all agent views |
| doNotContactReason | String? | Why they are DNC |
| doNotContactSetAt | DateTime? | When DNC was set |
| doNotContactSetBy | String? | Who set it |
| firstSeenAt | DateTime | When first imported |
| createdAt | DateTime | When record was created |
| updatedAt | DateTime | Last modification |
| deletedAt | DateTime? | Soft delete |

**CustomerType logic:**
- `NEW_REGISTRATION` — customer registered but never made a booking
- `CUSTOMER` — has at least one booking. Automatically upgraded during bookings import.

**Phone as master key:** The phone number is the unique identifier for every customer. When importing, if a phone number already exists, the system updates the existing record rather than creating a duplicate.

---

### Table: `Registration`

Historical record of each registration event. A customer can have one registration.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| customerId | String | FK to Customer |
| customerIdExt | String? (unique) | External customer ID — used for deduplication |
| onboardingDate | DateTime? | When they registered |
| rawData | Json? | The entire original row from the CSV, stored as JSON |
| createdAt | DateTime | When imported |

---

### Table: `Booking`

One row per booking event. A customer can have many bookings.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| customerId | String | FK to Customer |
| orderNo | String? (unique) | Order number — deduplication key |
| aiCallingStatus | String? | AI calling system status |
| orderDate | DateTime? | When order was placed |
| bookingDate | DateTime? | Actual appointment date |
| bookingTime | String? | Time of appointment |
| status | String? | Completed, Pending, Cancelled, etc. |
| paymentStatus | String? | Success, Failed, Partially Paid |
| salonId | String? | FK to Salon |
| salonNameSnapshot | String? | Salon name at time of booking (preserved even if salon changes) |
| city | String? | City of booking |
| grossAmount | Decimal? | Original price |
| stylistDiscount | Decimal? | Discount by stylist |
| slotsDiscount | Decimal? | Slots discount |
| couponsDiscount | Decimal? | Coupon discount |
| offersDiscount | Decimal? | Offer discount |
| hygieneFee | Decimal? | Hygiene charges |
| platformFee | Decimal? | Platform charges |
| grandTotal | Decimal? | Final amount paid |
| tokenAmount | Decimal? | Token/advance paid |
| remainingAmount | Decimal? | Balance remaining |
| rawData | Json? | Full original row from CSV |
| createdAt | DateTime | When imported |

---

### Table: `Salon`

Stores salon information.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| externalId | String? (unique) | Your salon ID from the spreadsheet |
| name | String | Salon name |
| phone | String? | Salon phone |
| address | String? | Address |
| city | String? | City |
| state | String? | State |

---

### Table: `Followup`

**The most important operational table.** One row per customer, tracks the current followup state. This is what agents see and work with every day.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| customerId | String (unique) | FK to Customer — one followup per customer |
| nextFollowupDate | DateTime | When to next contact this customer |
| currentRemark | String? | Last remark logged (e.g., "Call back", "Will book later") |
| currentNote | String? | Detailed note |
| lastContactedAt | DateTime? | When agent last called/remarked |
| lastContactedById | String? | Which agent last contacted |
| updatedAt | DateTime | Last modification |
| updatedById | String? | Who last updated this |

**Design decision:** There is only ONE followup row per customer. It always reflects the CURRENT state. History is preserved in the ActivityLog table.

---

### Table: `ActivityLog`

Append-only history log. Every action taken on a customer is recorded here. Never deleted.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| customerId | String | FK to Customer |
| userId | String? | FK to User — who did this |
| activityType | Enum | Type of activity |
| remark | String? | Remark text if applicable |
| note | String? | Note text if applicable |
| oldValue | String? | Previous value (for changes) |
| newValue | String? | New value (for changes) |
| createdAt | DateTime | When this happened |

**Activity types:**
- `REMARK_ADDED` — agent logged a remark
- `NOTE_ADDED` — agent added a note
- `FOLLOWUP_DATE_CHANGED` — followup date was changed
- `OWNER_CHANGED` — customer was reassigned to different agent
- `CUSTOMER_IMPORTED` — customer was created via import
- `BOOKING_IMPORTED` — booking was added via import
- `CUSTOMER_TYPE_CHANGED` — customer upgraded from Registered to Customer
- `DNC_FLAGGED` — customer marked Do Not Contact
- `DNC_UNFLAGGED` — DNC removed
- `CALL_LOGGED` — agent logged a call
- `REGISTRATION_IMPORTED` — registration record added

---

### Table: `RemarkOption`

The dropdown list agents see when logging a remark. Fully configurable from admin UI.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| label | String (unique) | The remark text (e.g., "Call back", "Not Interested") |
| color | String? | Display color |
| sortOrder | Int | Position in dropdown |
| isActive | Boolean | Whether it appears in the dropdown |
| defaultDaysAhead | Int? | If set, auto-suggests next followup date this many days ahead |
| autoFlagDnc | Boolean | If true, selecting this remark marks customer as DNC |
| closesFollowup | Boolean | If true, selecting this closes the followup |

---

### Table: `ImportHistory`

Log of every CSV import ever done.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Unique ID |
| importType | Enum (REGISTRATIONS/BOOKINGS) | Which type of import |
| filename | String | Original filename uploaded |
| uploadedById | String | FK to User — who uploaded |
| totalRows | Int | Total rows in file |
| newCount | Int | New records created |
| updatedCount | Int | Existing records updated |
| skippedCount | Int | Rows that were skipped |
| errorCount | Int | Rows that had errors |
| notes | String? | Summary notes |
| createdAt | DateTime | When import happened |

---

### Table: `Setting`

Key-value store for system configuration.

| Key | Description |
|-----|-------------|
| bookingFollowupDays | Number of days after a booking date to schedule the next followup (default: 20) |

---

## 7. Core Business Logic — Followups

This is the heart of the CRM. Every agent's day revolves around the followup view.

### Followup Status Categories

Every customer with a followup record falls into exactly one category:

---

**COLD** — Customer has NEVER been contacted and has no remarks.
- `currentRemark IS NULL`
- `lastContactedAt IS NULL`
- Not in the "Booked" group

These are customers that were imported but no agent has ever reached out to them. They should not be in the active pipeline — they are a backlog.

---

**BOOKED** — Same as Cold, but has an upcoming service appointment.
- `currentRemark IS NULL`
- `lastContactedAt IS NULL`
- Has a booking with a future date and non-cancelled status

These customers are confirmed for a service — no need to follow up urgently.

---

**TODAY'S FOLLOWUP** — Needs attention today.
Two groups qualify:
1. `nextFollowupDate` is today AND (recently contacted OR has a remark)
2. `lastContactedAt` is stale (more than 60 days ago) AND has a remark

---

**PIPELINE** — Active customers with upcoming followup dates.
- `nextFollowupDate` is tomorrow or later
- AND (recently contacted within 60 days OR never contacted but has a remark)

These are customers actively being worked — the agent has spoken to them and scheduled the next call.

---

**ACTION REQUIRED** — Overdue followups.
- `nextFollowupDate` is in the past
- AND has engagement (remark or recent contact)

These are customers whose scheduled followup date has passed without a call.

---

### Stale Threshold

`STALE_THRESHOLD_DAYS = 60`

If an agent last contacted a customer more than 60 days ago, that customer is considered "stale" and drops out of Pipeline/Action Required into the Cold bucket. This prevents customers from staying in the active pipeline indefinitely without engagement.

### New Booking Threshold

`NEW_BOOKING_DAYS = 20`

Used to determine if a customer has an upcoming booking within 20 days.

### Scope (Admin vs Agent)

Every followup query has a **scope**:
- Admin: `scope = { userId: null }` — sees ALL customers across ALL agents
- Agent: `scope = { userId: agentId }` — sees ONLY their own customers

This is enforced at the database query level, not just the UI level.

### Round-Robin Assignment

When new customers are imported and have no owner (or their owner name doesn't match any agent), they are automatically assigned via **round-robin**:

1. Load all active, non-leave agents
2. Count how many customers each agent currently owns
3. Assign new customers cyclically: agent 1, agent 2, agent 3, agent 1, agent 2...

**Sticky ownership:** If a customer already has an agent assigned, importing them again NEVER changes their agent. The existing assignment is always preserved.

---

## 8. Pages & Features

### `/` — Followups (Main Dashboard)

The home page every agent sees after logging in.

**For Agents:** Shows only their own customers.
**For Admin:** Shows all customers across all agents ("Team View").

**Features:**
- 5 stat cards: Cold, Booked, Today's Followup, Pipeline, Action Required
- Filter tabs to switch between categories
- Per-customer row showing: Status badge, Name, Last remark, Owner (admin only), Type badge, Phone, City, Last booking, Last contact date, Next followup date
- **Call button** — opens phone dialer with the number
- **WA button** — opens WhatsApp with pre-filled message
- **Update button** — opens modal to log remark, change date, add note
- **Open button** — goes to full customer profile
- Pagination: 50 customers per page
- Search bar (name or phone)

---

### `/customers` — Customer List

A searchable list of all customers.

**For Agents:** Only their assigned customers.
**For Admin:** All customers.

**Features:**
- Search by name (minimum 2 characters) or phone (minimum 4 digits)
- Shows: Name, Phone, City, Type, Owner (admin only), Status (Active/DNC/Closed), Next Followup date
- 50 per page with pagination

---

### `/customers/[id]` — Customer Profile

Full detail page for a single customer.

**Features:**
- All customer information
- Full booking history
- Full activity log (every remark, call, date change ever made)
- Followup management
- DNC flagging/unflagging
- Registration history

---

### `/stats` — My Stats (Agent only)

Personal performance dashboard for agents.

**Metrics shown:**
- Total owned customers
- Active customers (have followup, not DNC)
- DNC customers
- Due today
- Calls logged today / this week / this month
- Remarks added today / this week / this month

---

### `/profile` — Profile Page (Agent and Admin only)

Where agents and admins update their own account.

**Features:**
- Upload/change profile photo
- Change display name
- View email and role (read-only)
- Change password

**Not visible to Super Admin** — the Profile link is hidden in the sidebar for Super Admin.

---

### `/admin` — Admin Hub

Landing page for admin-only features. Four tiles:
1. All Customers
2. Closed Followups
3. Imports
4. Team

---

### `/admin/customers` — Admin Customer View

Full searchable customer database with advanced filters.

**Filters:**
- Search (name/phone)
- Owner (filter by specific agent)
- Customer type (Registered / Customer)
- Followup state (Active / DNC / No followup)

---

### `/admin/closed-followups` — Closed Followups

View and re-engage customers who are DNC or have no active followup.

---

### `/admin/imports` — Imports Hub

Three import cards + agent breakdown table + import history.

**Agent breakdown:** Shows each agent's name, status (Active/On Leave/Inactive), customer count, and percentage share of total customers.

**Import history:** Last 20 imports with filename, date, type, who uploaded, and counts.

---

### `/admin/team` — Team Management

Full agent management interface.

**Features:**
- View all agents with status, customer count, and last active
- Add new agent (name, email, password)
- Edit agent name
- Reset agent password (admin can set new password for any agent)
- Mark agent On Leave
- Reassign agent's customers to another agent
- Remove agent (soft delete — customers stay, agent can no longer log in)

---

### `/admin/stats` — Team Stats (Admin)

Performance overview for the entire team.

**Shows per agent:**
- Calls today / this week / this month
- Remarks today / this week / this month
- Customers owned
- Due today count

---

## 9. Import System

### Why imports exist

The CRM was designed to ingest data from existing spreadsheets that the team was already using. The import system handles messy real-world data gracefully.

### Step 1: Parse (shared across all import types)

**Endpoint:** `POST /api/admin/import/parse`

When a file is selected, it is immediately uploaded for parsing:
1. Reads the file (CSV or XLSX)
2. Returns the list of sheet names in the file
3. If only one sheet, auto-selects it
4. If multiple sheets, shows a dropdown to select

The `parseFile()` function in `src/lib/parseFile.ts` uses the `xlsx` (SheetJS) library to read both CSV and Excel files into a unified row array format.

The `getField()` function handles flexible column name matching. For example, `getField(row, "Contact Number", "Phone", "phone")` checks multiple possible column names and returns the first match. This handles inconsistent column naming across different spreadsheet versions.

---

### Step 2a: Import Registrations

**Endpoint:** `POST /api/admin/import/registrations/commit`

**Expected columns:** Contact Number, Customer ID, Name, Gender, Onboarding Date, Address, City, Sector, Owner

**What it does:**

1. **Pre-load** all users and existing customers into memory Maps
2. **Round-robin setup** — count current customers per agent, set up cycling index
3. **Parse each row:**
   - Normalize phone → skip if invalid
   - Deduplicate within the file (same phone twice = skip second)
   - Look up existing customer by phone
   - Determine owner: existing customer keeps their agent | named owner found → use them | named owner not found → round-robin | no owner → round-robin
4. **Bulk writes:**
   - `createMany` for all new customers
   - Fetch new customer IDs by phone
   - `createMany` for followup records (all set to today's date initially)
   - `createMany` for activity logs
   - `createMany` for registration records
   - Individual updates for existing customers (only fills in blank fields)
5. **Returns:** new count, updated count, skipped count, error count, agent breakdown (how many assigned to each agent)

---

### Step 2b: Import Bookings

**Endpoint:** `POST /api/admin/import/bookings/commit`

**Expected columns:** Order No, Customer Name, Contact Number, Salon Name, Salon Id, Order Date, Booking Date, Booking Time, Status, Payment Status, Grand Total, and all financial fields.

**What it does:**

1. **Pre-load** everything: users, salons, existing customers, their followups
2. **Round-robin** setup for new customers without an owner
3. **Deduplication:** If `orderNo` already exists in DB → skip (booking already imported)
4. **For each row:**
   - Normalize phone
   - Look up or prepare new customer record
   - Determine owner same as registrations
   - Classify booking type
5. **Bulk writes:**
   - Create new customers (those not in DB) with `createMany`
   - Upgrade `NEW_REGISTRATION` customers who now have bookings to `CUSTOMER` type
   - Create all booking records with `createMany`
   - Log activity for each booking
6. **Followup scheduling (Latest Booking Wins logic):**
   - Find the latest booking date for each customer across the ENTIRE database (not just this import)
   - If the latest booking in the import IS the overall latest → schedule followup as: `bookingDate + bookingFollowupDays` (default 20 days)
   - If there's a more recent booking in the DB already → skip (don't overwrite a newer followup date)
   - This prevents importing an old bookings file from overwriting followup dates set by newer bookings
7. **Returns:** new booking count, duplicate order count, upgraded customer count, followups created/updated/skipped, agent breakdown

---

### Step 2c: Import Combined Followups

**Endpoint:** `POST /api/admin/import/followups/commit`

**Expected columns:** Contact Number, Owner, Next Follow Up date, Remarks, Detailed Remarks

**Purpose:** One-time migration from the old spreadsheet. Imports the followup dates, remarks, and agent assignments that the team had been maintaining manually.

**Optimized for large files (bulk SQL approach):**

1. **Pre-load** all customers by phone and all agents by name in 2 parallel queries
2. **Parse all rows in memory** — no DB calls during parsing
3. **Pre-load** all existing followups for matched customers in 1 query
4. **Single bulk SQL UPDATE** for all followup updates using `json_array_elements`:
   ```sql
   UPDATE "Followup" f
   SET nextFollowupDate = ..., currentRemark = ..., ...
   FROM json_array_elements($data::json) AS v
   WHERE f."customerId" = v->>'cid'
   ```
   This updates ALL 13,866 customers in ONE database round trip.
5. **`createMany`** for any new followup records
6. **Single bulk SQL UPDATE** for owner changes

**Result: 4 total DB queries regardless of file size** (instead of 55,000+ sequential calls).

---

### Download Error Report

After any import, if there were rows with errors, a **"Download Error Report"** button appears. Clicking it generates and downloads an Excel file containing:
- Row number (which row in the original file failed)
- Reason (why it failed)
- All original data from that row

This is done entirely client-side using the `xlsx` library — no extra API call needed. The error data is already in the browser from the import response.

---

## 10. Data Normalization Logic

### Phone Number Normalization (`normalizePhone`)

Indian phone numbers come in many formats in spreadsheets. The normalizer handles all of them:

| Input | Output |
|-------|--------|
| `+91 98765 43210` | `9876543210` |
| `09876543210` | `9876543210` |
| `9876543210.0` | `9876543210` |
| `98765-43210` | `9876543210` |
| `(91) 9876543210` | `9876543210` |

**Logic:**
1. Remove `.0` suffix (Excel stores phone numbers as decimals sometimes)
2. Strip all non-digit characters
3. Take the last 10 digits (handles any prefix including `+91`, `0`, `91`)
4. Return empty string if fewer than 10 digits remain

### Date Parsing (`parseFlexibleDate`)

Handles multiple date formats found in real spreadsheets:

| Input | Parsed As |
|-------|-----------|
| `31-12-2025` | 31 Dec 2025 |
| `31/12/2025` | 31 Dec 2025 |
| `01-11-2025, 7:55:59 PM` | 1 Nov 2025 |
| `43891` (Excel serial) | 31 Jan 2020 |
| JS Date object | Used directly |

### String Cleaning (`cleanString`)

Removes junk values that appear in exported spreadsheets:
- `#N/A`, `N/A`, `#NA` → empty string
- `null`, `undefined` → empty string
- Leading/trailing whitespace → trimmed
- `-` alone → empty string

---

## 11. Profile & Photo System

### Profile Photo Flow

1. Agent uploads a photo on the Profile page
2. **Client-side:** File is read and shown as a preview immediately (no upload yet)
3. **On submit:** File is POSTed to `POST /api/profile/photo`
4. **Server:** Photo is stored as **base64 in the database** (`User.profilePhoto` field)
5. **Response:** Returns `{ photoUpdatedAt: timestamp }`
6. **Client:** Updates `localPhotoVersion` state immediately for instant display, then calls `session.update()` to refresh the JWT, then `router.refresh()` for server components

### Why base64 in the database?

Vercel has no persistent filesystem. Files cannot be saved to disk. The only persistent storage available is the database. The photo is stored as a base64-encoded string in a `TEXT` column.

### Cache-busting with photoUpdatedAt

The photo is served at `/api/profile/photo`. To prevent the browser from showing a stale cached photo after upload, a version timestamp is appended:
```
/api/profile/photo?v=1715000000000
```

This `v` parameter is the `User.updatedAt` timestamp stored in the JWT. When the photo changes, `updatedAt` changes, the URL changes, and the browser fetches the new photo.

### Why NOT store the photo in the JWT

Initially, the base64 photo was stored directly in the JWT cookie. This caused **HTTP 431 Request Header Too Large** errors because:
- A profile photo (even small) in base64 is ~100KB
- Browsers have a limit on HTTP header size (~8KB total)
- The JWT cookie is sent with EVERY request as an HTTP header
- Result: Every page load failed

**Fix:** Store only the tiny timestamp in the JWT. Fetch the actual photo via a separate API call.

### Photo API endpoints

- `GET /api/profile/photo?v=timestamp` — Fetches and returns the photo as binary image data with proper `Content-Type`. Cached for 24 hours (`Cache-Control: private, max-age=86400`).
- `POST /api/profile/photo` — Upload new photo
- `DELETE /api/profile/photo` — Remove photo

---

## 12. Admin Features

### Team Management (`/admin/team`)

**Add Agent:**
- Enter name, email, password
- Password is bcrypt-hashed before saving
- Agent can immediately log in

**Mark On Leave:**
- Sets `onLeaveFrom` date
- Agent's customers are excluded from round-robin during import
- Agent's status shows "On Leave" in team and import views
- Automatically cleared on next login

**Reassign Customers:**
- Transfer all customers from one agent to another
- Useful when an agent leaves permanently

**Remove Agent (Soft Delete):**
- Sets `deletedAt` — agent cannot log in
- All their customers remain in the system
- Their history is preserved

**Reset Password:**
- Admin can set a new password for any agent
- Useful when an agent forgets their password

### Customer Management (`/admin/customers`)

Full database view with filters:
- Search by name or phone
- Filter by owner (show one agent's customers)
- Filter by customer type (Registered/Customer)
- Filter by followup state (Active/DNC/No followup)

### Imports (`/admin/imports`)

- Triggering the 3 import flows
- Viewing agent customer distribution
- Viewing import history

---

## 13. Agent Features

### Daily Workflow

1. Log in → Followups page shows today's work
2. Click "Today" tab → see who needs to be called today
3. For each customer: Click Call → make the call → Click Update → log what happened
4. In the Update modal:
   - Select remark from dropdown (Call back, Not interested, etc.)
   - Optionally add a detailed note
   - Optionally change the next followup date
5. Customer moves to Pipeline (future date set) or Action Required (if not updated)

### Logging Calls

When an agent clicks "Call":
- Opens the phone dialer with the customer's number
- A call is logged in ActivityLog

### WhatsApp Button

Generates a `wa.me` link with:
- Customer's phone number
- Pre-filled message: "Hi [CustomerName], this is from Style Lounge."

### Viewing Customer Profile

The customer profile page shows:
- All customer details
- Every booking they've ever made (with amounts, salon, dates)
- Complete activity history (every call, remark, date change, import event)

---

## 14. Super Admin

The Super Admin is a special account that exists only in environment variables — not in the database.

**What Super Admin can do:**
- Everything an Admin can do
- Manage the Admin account
- Access all imports and team management

**What Super Admin cannot do:**
- Update their profile (no Profile page)
- Upload a profile photo
- Their actions are attributed to the real Admin's database ID for foreign key constraints

**Credentials:** Set via `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` environment variables. Change these in Vercel's environment settings to rotate credentials.

---

## 15. How Everything Connects

```
Browser
  │
  ├── GET page request
  │     └── Next.js Server Component
  │           ├── auth() → reads JWT cookie → gets user ID + role
  │           └── Prisma → queries Neon DB → returns data → renders HTML
  │
  └── POST/API request (button clicks, form submits)
        └── Next.js API Route (serverless function)
              ├── auth() → validates session
              ├── Business logic
              └── Prisma → writes to Neon DB → returns JSON
```

### Data flow for "Agent logs a remark":

1. Agent clicks "Update" on a customer
2. Modal opens (client component) with current remark and date
3. Agent selects remark, sets date, clicks Save
4. Client POSTs to `/api/followups/save` with `{ customerId, remark, note, nextFollowupDate }`
5. API validates session (must be owner or admin)
6. API updates `Followup` record: sets remark, date, lastContactedAt
7. API creates `ActivityLog` entry: type=REMARK_ADDED
8. API returns success
9. Client closes modal, page refreshes to show updated state

---

## 16. Deployment Step-by-Step

### How this CRM was deployed for free

#### Step 1: Create Neon Database

1. Go to [neon.tech](https://neon.tech)
2. Sign up (free)
3. Create new project → select region: **ap-southeast-1 (Singapore)**
4. Copy the connection string (looks like `postgresql://user:pass@host.neon.tech/neondb?sslmode=require`)

#### Step 2: Run Database Migration

Locally, with the Neon connection string in `.env`:
```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
```
This creates all the tables in Neon.

#### Step 3: Seed the database (optional)

```bash
DATABASE_URL="your-neon-connection-string" npx prisma db seed
```
Creates initial data like default remark options and settings.

#### Step 4: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New Project"
4. Import the `CRM-2.0` GitHub repository
5. Vercel auto-detects it's a Next.js project

#### Step 5: Set Environment Variables in Vercel

In Vercel project settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon connection string |
| `AUTH_SECRET` | A random 32+ character string (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://your-project-name.vercel.app` (your actual Vercel URL) |
| `SUPER_ADMIN_EMAIL` | Your super admin email |
| `SUPER_ADMIN_PASSWORD` | Your super admin password |

#### Step 6: Deploy

Vercel automatically deploys on every push to the connected GitHub repo. The first deployment happens automatically after you import the project.

#### Step 7: Run Migrations on Production

If you make schema changes after the initial deployment:
```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
```
Run this locally — it connects to Neon directly and applies the migration.

#### Step 8: Import Data

1. Log in as Admin (or Super Admin)
2. Go to Admin → Imports
3. Import Registrations CSV first
4. Import Bookings CSV second
5. Import Combined Followups CSV third

**Order matters.** Registrations creates the customer records. Bookings adds booking history and upgrades customer types. Combined Followups adds the followup dates and remarks.

---

## 17. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Secret key for signing JWT tokens. Must be 32+ chars. Must be the same across all deployments. If changed, all existing sessions are invalidated (everyone is logged out). |
| `NEXTAUTH_URL` | Yes | Full URL of your deployed app (e.g., `https://crm-2-0-nu.vercel.app`). Used by NextAuth for redirect URLs. |
| `SUPER_ADMIN_EMAIL` | Yes | Email to log in as Super Admin |
| `SUPER_ADMIN_PASSWORD` | Yes | Password to log in as Super Admin |

**Local development:** These are in the `.env` file (never commit this to GitHub).
**Production:** These are in Vercel's Environment Variables settings panel.

---

## 18. Vercel Limits & Constraints

### Hobby Plan (Free Tier) Limits

| Limit | Value | Impact |
|-------|-------|--------|
| Serverless function timeout | **60 seconds** | Large imports must be optimized with bulk SQL |
| Request body size | **4.5 MB** | CSV/XLSX files must be under this |
| Bandwidth | 100 GB/month | More than enough for a small team |
| Function invocations | 100,000/month | More than enough |
| Team members on Vercel | 1 (just the owner) | Only you can manage the project on Vercel |
| Deployments | 100/day | Not a concern |

### Key constraint: 60-second timeout

This is the most important limit. Every API route (serverless function) must complete within 60 seconds. For large CSV imports (13,000+ rows), this required major optimization:

**Solution:** Instead of processing each row with individual database calls (which would take minutes), all data is pre-loaded into memory, processed, and written back with bulk SQL in a few large operations. Total DB round trips: 4-5 regardless of file size.

### No persistent filesystem

Cannot save files to disk. Everything must go in the database. This is why:
- Profile photos are stored as base64 in the database
- CSV files are processed in memory and discarded after import

---

## 19. Known Behaviours & Edge Cases

### Timezone

Vercel servers run on **UTC**. India is **UTC+5:30 (IST)**. This means:
- "Today" resets at 5:30 AM IST (midnight UTC)
- Customers move from Pipeline to "Today's Followup" at 5:30 AM IST each day
- In practice, this is before the team starts work — so it works fine

### Neon Cold Start

If the app hasn't been used for ~5 minutes, Neon's database scales to zero. The next request will take 2-5 extra seconds while Neon wakes up. Subsequent requests within the session are fast.

### 67 "Cold" customers with future dates

After the initial import, 67 customers had future followup dates but appeared in "Cold" instead of "Pipeline". This is correct behaviour:
- Pipeline requires a remark OR recent contact as evidence of engagement
- These 67 had no remark (empty Remarks column in the spreadsheet)
- They will naturally move to Pipeline once an agent contacts them and logs a remark

### Super Admin FK constraint

Super Admin's ID (`"super-admin"`) does not exist in the database. Any API operation that needs to record who performed an action (import history, activity logs) uses the real Admin's database ID as a fallback when the actor is Super Admin.

### Sticky ownership

Once a customer is assigned to an agent, importing that customer again (in any import type) will never change their agent. The only way to reassign is via Team Management (bulk reassign) or directly in the customer profile.

### Import deduplication

- **Registrations:** Deduplicated by phone number
- **Bookings:** Deduplicated by order number (`orderNo`)
- **Combined Followups:** Updates existing records (no deduplication needed — one followup per customer)

### Two GitHub repos

There are two repos:
- `origin` → `https://github.com/Abhinavp1812/crm.git` (development backup)
- `crm2` → `https://github.com/Abhinavp1812/CRM-2.0.git` (Vercel watches this)

Always push to both:
```bash
git push origin main
git push crm2 main
```

Or push to both in one command:
```bash
git push origin main && git push crm2 main
```

---

*Document generated: May 2026*
*CRM Version: as of commit `01e4d54`*
*Built for Style Lounge by Abhinav with Claude (Anthropic)*
