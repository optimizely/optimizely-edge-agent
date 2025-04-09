**The Goal: Helping Users Get Started with Tags Quickly**

We know tags are powerful for organizing research (`ContentSource`s). However, starting with a blank slate can be daunting, especially for new users or teams. Different fields (law, medicine, academia) use different terminology and organizational structures.

The **Default Tag Sets** feature aims to solve this by providing **pre-packaged lists of common, useful tags** relevant to specific domains or workflows. Users can then easily import these sets into their own tenant account, giving them a great starting point without having to manually type dozens or hundreds of tags.

**How It Works for the End User (The Vision):**

1.  **Location:** A user (likely a tenant admin/owner) navigates to their Tenant Settings, probably within a dedicated "Tags Management" or "Organization Settings" section.
2.  **Discovery:** They see a section titled something like "Import Default Tag Sets" or "Suggested Tag Libraries".
3.  **Browsing Sets:** The UI displays a list of available *Default Tag Sets* that *your team* has predefined (e.g., "Workflow Status", "Legal Research", "Academic Research Methods", "Source Credibility"). Each set would show:
    *   Its **Name** (e.g., "Legal Research Tags")
    *   Its **Description** (e.g., "Common tags for legal case analysis")
    *   Maybe a **count** of how many tags are inside.
    *   Potentially a **preview** button to see the actual tags within the set (e.g., "Case Law", "Statute", "Regulation").
4.  **Selection:** The user can select one or more of these predefined sets using checkboxes or selection buttons. For example, a law firm might select "Workflow Status", "Source Credibility", and "Legal Research". An academic might select "Workflow Status", "Source Credibility", and "Academic Research Methods".
5.  **Import Action:** The user clicks an "Import Selected Sets" button.
6.  **Behind the Scenes:** The frontend sends the IDs of the selected `DefaultTagSet`s to the backend API endpoint (`POST /api/app/:tenantId/tags/import-defaults`).
7.  **Backend Processing:** The NestJS `DefaultTagService` receives the request:
    *   It fetches all the `DefaultTag`s associated with the selected `DefaultTagSet` IDs.
    *   For *each* fetched `DefaultTag`, it performs a `prisma.contentTag.upsert` operation *specifically for the user's `tenantId`*.
        *   `where`: It checks if a `ContentTag` with the *same name* already exists *for that tenant*.
        *   `create`: If it doesn't exist, it creates a new `ContentTag` for the tenant using the `name` and suggested `color` from the `DefaultTag`.
        *   `update`: If a tag with that name *already exists* for the tenant (maybe they created it manually before importing), the `upsert` simply ensures it exists and potentially updates the color if desired (or does nothing to preserve user customization).
8.  **User Feedback:** The UI shows a success message (e.g., "Successfully imported X tags from Y sets.") or any errors.
9.  **Result:** The user now sees these imported tags available in their tenant's tag list when they go to tag a `ContentSource`. They appear alongside any custom tags the user creates manually. They can manage these imported tags (change color, delete them *from their tenant*) just like any other `ContentTag`.

**What Your Team Needs to Do (One-Time Setup & Ongoing Maintenance):**

This is **not** something end-users or individual engineers do repeatedly. It's part of the initial platform setup and ongoing curation by your team.

1.  **Define the Default Sets & Tags:**
    *   **Action:** Create the comprehensive lists of tags, grouped into logical sets (like the categorized examples I provided: Workflow, Content Type, Legal, Academic, Medical, Financial, Business, Engineering, Source Credibility, Personal Assessment). Decide on the `name` (internal ID like `legal_research`), user-facing `description`, and suggested `color` for each tag.
    *   **Location:** Store this structured data, perhaps in a dedicated file within the backend codebase (e.g., `rko-backend/src/tags/data/default-tag-sets.ts`).
2.  **Implement the Seeding Logic:**
    *   **Action:** Write/update the `prisma/seed.ts` script. This script will read the data defined in step 1 and use `prisma.defaultTagSet.upsert` and `prisma.defaultTag.upsert` to populate the `DefaultTagSet` and `DefaultTag` tables in the database.
    *   **Execution:** Run `npx prisma db seed` during initial setup and potentially after updates to the default tag lists (seeding is idempotent due to `upsert`).
3.  **Implement the Backend Service & API:**
    *   **Action:** Build the `DefaultTagService` in NestJS with the `importDefaultTags` and `listAvailableSets` methods as planned.
    *   **Action:** Create the corresponding API endpoints (`GET /api/default-tag-sets` and `POST /api/app/:tenantId/tags/import-defaults`).
4.  **Implement the Admin UI (Optional but Recommended):**
    *   **Action:** Build an interface within the `/admin` section for SuperAdmins to manage the `DefaultTagSet`s and `DefaultTag`s directly in the database (CRUD operations). This allows easy updates without needing code changes or reseeding for simple additions/modifications.
5.  **Implement the Tenant Import UI:**
    *   **Action:** Build the UI within the tenant settings where users can browse and import the available `DefaultTagSet`s. This involves fetching data from `GET /api/default-tag-sets` and sending selections to `POST /api/app/:tenantId/tags/import-defaults`.

**In Summary:**

*   **Your Team:** Defines and seeds the *master list* of default tags, grouped into sets (`DefaultTagSet`, `DefaultTag` tables). Builds the backend service and API endpoints for listing and importing these sets. Builds the UI for tenants to select and import. Optionally builds an admin UI to manage the master list.
*   **End User:** Goes to their settings, sees the available sets (e.g., "Legal Research"), selects the ones relevant to them, clicks "Import", and those tags are then copied/created as *their own* tenant-specific `ContentTag`s, ready to use for organizing their research content.

This approach provides significant value by accelerating user onboarding with tags, promoting consistent tagging within domains, while still allowing full customization as users can always create their own tags or modify/delete imported ones within their tenant scope.