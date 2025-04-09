Okay, let's proceed with Strategy 1 (Parallel Systems). Here are the detailed plans you requested:

## 1. Plan for Prisma Schema Updates (AI Agent/Engineer Instructions)

* **Objective:** Modify the existing `schema.prisma` file to support the new RKO architecture requirements, including Collections, AI task tracking (`AsyncTask`), refined content models (`ContentSource`, `RawChunk`, `ProcessedContent`), research-specific tagging (`ContentTag`), billing tracking, and simplified RBAC, while ensuring backward compatibility by keeping the existing `Job` system separate.
* **Prerequisites:** Access to the current `schema.prisma` file.
* **Strategy:** Apply changes sequentially. Use Prisma Migrate for applying changes to the database.

---

**Instructions for Modifying `schema.prisma`:**

**Step 1: Define/Update Enums**

* **Action:** Add or ensure the following enums are defined. Use these enums in the corresponding model fields specified in subsequent steps.
    ```prisma
    // For ContentSource type
    enum SourceType {
      PDF
      DOCX
      URL
      TXT
      IMAGE
      // Add other relevant types as needed
    }

    // For ContentSource status tracking ingestion and chunking
    enum ContentSourceStatus {
      UPLOADING // Initial state during upload
      UPLOADED  // Raw file stored successfully
      CHUNKING  // Chunking process in progress
      CHUNKED   // Chunking completed successfully
      CHUNKING_FAILED // Chunking process failed
      // Consider if higher-level statuses like PROCESSING/PROCESSED are needed here,
      // or if that's tracked per-chunk via ProcessedContent status. Let's keep it focused on ingestion/chunking for now.
      ERROR     // General error state for the source
    }

    // For ProcessedContent status (AI processing of a chunk/source)
    enum ProcessedContentStatus {
      PENDING    // AI processing requested but not started
      PROCESSING // AI processing is actively running
      COMPLETED  // AI processing finished successfully
      ERROR      // AI processing failed
    }

    // For AsyncTask status (tracking the queue job itself)
    enum AsyncTaskStatus {
      PENDING    // Task created, message not yet sent or picked up
      QUEUED     // Message successfully sent to Cloudflare Queue
      PROCESSING // Message picked up by ai-queue-worker, processing started
      COMPLETED  // Processing completed successfully (result stored)
      ERROR      // Processing failed permanently or after retries
      RETRY      // Processing failed, will be retried by queue mechanism
    }

    // For type of AI transformation
    enum TransformationType {
      SUMMARY
      EMBEDDING
      CITATION_EXTRACTION
      Q_AND_A
      // Add other planned AI task types
    }

    // For simplified Tenant-level roles
    enum TenantRole {
      OWNER // e.g., Creator, Billing Admin
      ADMIN
      MEMBER
    }

    // For Billing Period status
    enum BillingPeriodStatus {
      OPEN    // Current active period, usage accumulating
      CLOSED  // Period ended, ready for invoicing/payment processing
      PAID    // Invoice paid
      VOID    // Period/Invoice voided
    }

    // Ensure WorkspaceRole exists (as provided by user)
    // enum WorkspaceRole { OWNER, ADMIN, MEMBER, VIEWER }
    ```

**Step 2: Add `Collection` Model**

* **Action:** Add the model for grouping `ContentSource`s.
    ```prisma
    model Collection {
      id            String   @id @default(uuid())
      name          String
      description   String?
      tenantId      String   // Belongs to a tenant
      createdById   String   // User who created it
      createdAt     DateTime @default(now())
      updatedAt     DateTime @updatedAt

      // Relations
      tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
      createdBy     User           @relation(fields: [createdById], references: [id], onDelete: Cascade)
      contentSources ContentSource[] // Groups multiple ContentSources
    }
    ```

**Step 3: Add `ContentTag` and `ContentSourceTag` Models**

* **Action:** Add models for research-specific tagging.
    ```prisma
    model ContentTag {
      id          String   @id @default(uuid())
      name        String   // The tag text (e.g., "Machine Learning", "Case Study")
      tenantId    String   // Tags are scoped to a tenant
      createdAt   DateTime @default(now())

      // Relations
      tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
      sourceTags  ContentSourceTag[] // Link to join table

      @@unique([tenantId, name]) // Enforce unique tag names within a tenant
    }

    model ContentSourceTag {
      contentSourceId String
      contentTagId    String
      assignedAt      DateTime @default(now())
      assignedById    String   // User who applied the tag

      // Relations
      contentSource ContentSource @relation(fields: [contentSourceId], references: [id], onDelete: Cascade)
      contentTag    ContentTag    @relation(fields: [contentTagId], references: [id], onDelete: Cascade)
      assignedBy    User          @relation(fields: [assignedById], references: [id], onDelete: Cascade)

      @@id([contentSourceId, contentTagId]) // Composite primary key
    }
    ```

**Step 4: Add `AsyncTask` Model (For NEW AI Queue System)**

* **Action:** Add the model specifically for tracking AI jobs processed by the new queue system. **Do NOT modify the existing `Job` model.**
    ```prisma
     model AsyncTask {
       id             String    @id @default(uuid()) // Use UUID for task ID passed to/from Worker
       tenantId       String    // For billing/isolation/lookup
       userId         String?   // User who initiated (if applicable)
       taskType       TransformationType // Use Enum: What kind of AI task?
       status         AsyncTaskStatus    // Use Enum: Tracks the job lifecycle
       inputLocation  String?   @db.Text // Identifier for input (e.g., ContentSource ID, RawChunk ID, R2 path)
       resultLocation String?   @db.Text // R2 path where primary output artifact is stored
       errorMessage   String?   @db.Text // Store error details if status is ERROR
       retries        Int       @default(0) // Track retry attempts (managed by queue or worker logic)
       modelUsed      String?   // ADDED: Store model used directly on task for easier lookup
       createdAt      DateTime  @default(now())
       updatedAt      DateTime  @updatedAt

       // Relations
       tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
       user           User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
       processedOutputs ProcessedContent[] // Link to the ProcessedContent record(s) generated

       @@index([tenantId, status, createdAt]) // Index for querying tasks
     }
    ```

**Step 5: Add Billing Models**

* **Action:** Add models required for usage tracking and billing.
    ```prisma
     model UsageRecord {
       id               String   @id @default(uuid())
       tenantId         String
       asyncTaskId      String?  // Link to the specific AI task run
       processedContentId String? // Link to the specific processed output (if needed)
       timestamp        DateTime @default(now()) // Time the usage occurred (approx)
       modelUsed        String   // Model identifier for pricing lookup
       promptTokens     Int      @default(0) // Tokens input to the model
       completionTokens Int      @default(0) // Tokens output by the model
       calculatedCost   Decimal  @db.Decimal(10, 6) // Cost calculated based on tokens and pricing

       // Relations
       tenant           Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
       asyncTask        AsyncTask?        @relation(fields: [asyncTaskId], references: [id], onDelete: SetNull)
       processedContent ProcessedContent? @relation(fields: [processedContentId], references: [id], onDelete: SetNull)

       @@index([tenantId, timestamp])
     }

     model BillingPeriod {
       id          String   @id @default(uuid())
       tenantId    String
       startDate   DateTime // Start of the billing cycle
       endDate     DateTime // End of the billing cycle
       totalCost   Decimal  @db.Decimal(12, 6) @default(0.0) // Aggregated cost for the period
       status      BillingPeriodStatus // Use Enum: OPEN, CLOSED, PAID, VOID
       invoiceUrl  String?  // Link to generated invoice if applicable
       createdAt   DateTime @default(now())
       updatedAt   DateTime @updatedAt

       // Relations
       tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

       @@unique([tenantId, startDate, endDate]) // Prevent overlapping periods
     }

     model AIModelPricing {
       modelIdentifier      String   @id // e.g., "gpt-4-turbo", "@cf/baai/bge-base-en-v1.5"
       promptTokenCost      Decimal  @db.Decimal(10, 8) // Cost per 'unit' tokens (e.g., per 1000)
       completionTokenCost  Decimal  @db.Decimal(10, 8) // Cost per 'unit' tokens (e.g., per 1000)
       unit                 Int      @default(1000)   // Denominator for cost (e.g., 1000 tokens)
       currency             String   @default("USD")   // Currency code
       description          String?  // Optional description of the model/pricing tier
       isActive             Boolean  @default(true)    // Flag to activate/deactivate pricing
       createdAt            DateTime @default(now())
       updatedAt            DateTime @updatedAt
     }
    ```

**Step 6: Modify `ContentSource` Model**

* **Action:** Find the existing `ContentSource` model and apply these changes:
    ```prisma
    model ContentSource {
      id               String    @id @default(uuid())
      // name          String // REMOVED/REPLACED by originalName
      originalName     String?   // ADDED: Original filename or URL title
      sourceType       SourceType // UPDATED: Use Enum
      originalLocation String    @db.Text // ADDED: R2 object key or original URL. REQUIRED. Ensure this field is added and populated correctly.
      size             Int?      // ADDED: File size in bytes
      mimeType         String?   // ADDED: Detected MIME type
      configuration    Json?
      tenantId         String
      collectionId     String    // ADDED: Link to Collection
      status           ContentSourceStatus @default(UPLOADED) // ADDED/UPDATED: Use Enum
      createdById      String
      createdAt        DateTime  @default(now())
      updatedAt        DateTime  @updatedAt

      // Relations
      tenant           Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
      collection       Collection         @relation(fields: [collectionId], references: [id], onDelete: Cascade) // ADDED Relation
      createdBy        User               @relation(fields: [createdById], references: [id], onDelete: Cascade)
      chunks           RawChunk[]         // Relation to existing RawChunk model
      tags             ContentSourceTag[] // ADDED: Relation to join table
      // processedVersions ProcessedContent[] // REMOVED: Processing happens per-chunk now
    }
    ```

**Step 7: Modify `RawChunk` Model**

* **Action:** Find the existing `RawChunk` model and update the relation name. Add index.
    ```prisma
    model RawChunk {
      id              String    @id @default(uuid())
      content         String    @db.Text // Content of the chunk
      metadata        Json?     // Page number, position, etc.
      sourceId        String    // Link back to the parent ContentSource
      chunkIndex      Int?      // ADDED: Order/index of chunk within source (if not in metadata)
      contentHash     String?   // Keep for potential deduplication
      tenantId        String
      createdById     String
      createdAt       DateTime  @default(now())
      updatedAt       DateTime  @updatedAt

      // Relations
      source          ContentSource     @relation(fields: [sourceId], references: [id], onDelete: Cascade)
      tenant          Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
      createdBy       User              @relation(fields: [createdById], references: [id], onDelete: Cascade)
      processedContents ProcessedContent[] // UPDATED Relation name to link to renamed model

      @@index([sourceId, chunkIndex]) // ADDED Index for ordering/lookup
    }
    ```

**Step 8: Rename `ProcessedChunk` to `ProcessedContent` and Modify**

* **Action:** Find the existing `ProcessedChunk` model, rename it to `ProcessedContent`, and add/modify fields:
    ```prisma
    model ProcessedContent { // RENAMED from ProcessedChunk
      id                 String    @id @default(uuid())
      resultLocation     String?   @db.Text // ADDED: R2 path for large results (embeddings file, summary doc)
      resultText         String?   @db.Text // ADDED: Direct text storage for short results (e.g., short summary, extracted text)
      embedding          Bytes?    // Keep: For storing vector embeddings directly if desired/performant
      metadata           Json?     // Keep: Metadata about the result (e.g., confidence scores)
      rawChunkId         String    // Keep: Link to the specific source chunk
      transformationType TransformationType // ADDED: Use Enum. What AI process created this? REQUIRED.
      status             ProcessedContentStatus @default(PENDING) // ADDED: Use Enum. Tracks AI processing. REQUIRED.
      modelUsed          String?   // ADDED: Identifier of the AI model used
      promptUsed         String?   @db.Text // ADDED: Optional: The specific prompt used
      version            Int       @default(1) // ADDED: Version for this chunk/transformation type
      asyncTaskId        String?   // ADDED: Link back to the generating AsyncTask
      createdAt          DateTime  @default(now())
      updatedAt          DateTime  @updatedAt

      // Relations
      rawChunk           RawChunk          @relation(fields: [rawChunkId], references: [id], onDelete: Cascade)
      asyncTask          AsyncTask?        @relation(fields: [asyncTaskId], references: [id], onDelete: SetNull) // ADDED Relation
      workspaceBlocks    WorkspaceContent[] // ADDED: Link to WorkspaceContent/Block where this is used (Ensure WorkspaceContent updated)

      @@unique([rawChunkId, transformationType, version]) // ADDED: Enforce unique versions per chunk/type
      @@index([asyncTaskId]) // ADDED: Index for lookup
    }
    ```

**Step 9: Modify `WorkspaceContent` Model**

* **Action:** Find `WorkspaceContent`. Strongly consider renaming to `WorkspaceBlock`. Add `processedContentId` link, remove `sourceId` link.
    ```prisma
    // Consider renaming model WorkspaceContent to WorkspaceBlock for clarity
    model WorkspaceContent { // Or WorkspaceBlock
      id                 String     @id @default(uuid())
      title              String     // Title of the block within the workspace
      content            String?    @db.Text // Final, potentially edited content (e.g., Slate JSON, Markdown)
      workspaceId        String     // Link to the parent workspace
      sectionId          String?    // Link to the section within the workspace
      order              Int?       // ADDED: Order of block within section/workspace
      processedContentId String?    // ADDED: Link to the specific ProcessedContent version this block represents or was derived from
      createdById        String
      // status          String     @default("draft") // Consider Enum: WorkspaceBlockStatus { DRAFT, PUBLISHED }
      // sourceId        String?    // REMOVED Direct link to source
      createdAt          DateTime   @default(now())
      updatedAt          DateTime   @updatedAt

      // Relations
      workspace          Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
      section            WorkspaceSection?  @relation(fields: [sectionId], references: [id], onDelete: SetNull)
      processedContent   ProcessedContent?  @relation(fields: [processedContentId], references: [id], onDelete: SetNull) // ADDED Relation
      createdBy          User               @relation(fields: [createdById], references: [id], onDelete: Cascade)
    }
    ```

**Step 10: Simplify RBAC (Apply If Chosen)**

* **Action:** Execute this step ONLY if the decision to simplify RBAC is confirmed.
    * Delete the full model definitions for `Role`, `Permission`, `UserRole`, `TenantUserRole`.
    * Find the `TenantUser` model and modify the `role` field: change `role String @default("member")` to `role TenantRole @default(MEMBER)` (using the `TenantRole` enum defined in Step 1).

**Step 11: Remove `Job` Model (Apply If Confirmed)**

* **Action:** Based on Strategy 1, we keep the `Job` model for the *existing* queue system. **DO NOT REMOVE THE `Job` MODEL.** (Correction from previous thought process - user wants backward compatibility).

**Step 12: Review `Category`/`ContentCategory` (Optional)**

* **Action:** No changes required by the agent for now. Human review recommended later to determine the purpose and necessity of these models alongside `Collection` and `ContentTag`.

**Step 13: Final Prisma Commands**

* **Action:** After saving all changes to `schema.prisma`, run the following commands in the terminal:
    1.  `npx prisma format`
    2.  `npx prisma generate`
    3.  `npx prisma migrate dev --name "feat_add_ai_content_models"` (Or a similar descriptive name - **Use migrations**)

---
**Output:** An updated `schema.prisma` file reflecting these changes, and a new migration file generated by Prisma Migrate.

---

## 2. Architecture and Instructions for AI Queue Worker (`ai-queue-worker`)

* **Objective:** Define and implement the Cloudflare Worker (`ai-queue-worker`) responsible for consuming AI task messages from the dedicated queue (`rko-async-ai-tasks`), executing the AI processing via AI Gateway, and updating the system status.
* **Strategy:** This worker handles the core AI logic, interacting with Cloudflare services (Queue, R2, AI Gateway) and calling back to the NestJS backend (`Data Management Service`) only to update state.

---

**Instructions for Implementing `ai-queue-worker`:**

**Step 1: Setup Worker Project**

* **Action:** In the `rko-infrastructure` repository, create a new Worker project using Wrangler CLI and TypeScript.
    ```bash
    npx wrangler init ai-queue-worker
    cd ai-queue-worker
    npm install jose # If needed for auth token validation/creation (API key preferred for callback)
    # Add other dependencies if needed
    ```
* **Output:** A new Cloudflare Worker project directory with `wrangler.toml` and `src/index.ts`.

**Step 2: Configure `wrangler.toml`**

* **Action:** Edit `wrangler.toml` to configure the worker name, main entry point, and necessary bindings and secrets/variables.
    ```toml
    name = "ai-queue-worker"
    main = "src/index.ts"
    compatibility_date = "YYYY-MM-DD" # Use a recent date

    # Queue Consumer Binding (MUST match the queue name created in Cloudflare)
    [[queues.consumers]]
    queue = "rko-async-ai-tasks"
    max_batch_size = 5       # Adjust as needed
    max_batch_timeout = 30   # Adjust as needed
    max_retries = 3          # Adjust as needed

    # R2 Bucket Binding (MUST match the bucket name created in Cloudflare)
    [[r2_buckets]]
    binding = "R2_STORAGE"
    bucket_name = "rko-storage"
    # preview_bucket_name = "rko-storage-dev" # Optional: for local dev/preview

    # Environment Variables / Secrets (Use 'wrangler secret put <NAME>' for secrets)
    [vars]
    DATA_SERVICE_URL = "https://your-nestjs-backend.com/api" # Example URL for your deployed backend
    AI_GATEWAY_CF_ENDPOINT = "https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/workers-ai" # Replace ACCOUNT_ID
    AI_GATEWAY_OPENAI_ENDPOINT = "https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/openai" # Replace ACCOUNT_ID
    # Add other AI Gateway endpoints as needed

    # MANDATORY Secret for authenticating callbacks to NestJS backend
    # Set using: wrangler secret put INTERNAL_API_KEY
    # Example value generation: openssl rand -hex 32
    # INTERNAL_API_KEY = "requires-secret" # Value set via wrangler secret

    # Optional: R2 credentials if using SDK instead of binding (Not recommended if binding works)
    # R2_ACCESS_KEY_ID = "requires-secret"
    # R2_SECRET_ACCESS_KEY = "requires-secret"
    # R2_ENDPOINT = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
    ```
* **Output:** Configured `wrangler.toml`.

**Step 3: Define Types (in `src/types.ts` or similar)**

* **Action:** Define TypeScript interfaces for the expected queue message body (based on `AIRequest` + `taskID`) and the callback payload to the NestJS backend.
    ```typescript
    // src/types.ts

    import { TransformationType } from './enums'; // Assuming enums are defined

    // Based on AIRequest from ai-handler-worker + taskID
    export interface AIQueueMessage {
      taskID: string;          // UUID generated by ai-handler-worker
      customerID: string;      // TenantID (orgId)
      userID?: string;         // Optional user who initiated
      taskType: TransformationType;
      inputData: {
        type: 'text' | 'r2_path';
        value: string; // Text content or R2 object key
      };
      outputFormat?: 'text' | 'json';
      providerPreference?: string; // 'cloudflare', 'openai', etc.
      options?: Record<string, any>;
    }

    // Payload for updating AsyncTask via NestJS API callback
    export interface UpdateTaskPayload {
      status: 'COMPLETED' | 'ERROR'; // Final states
      resultLocation?: string;        // R2 path to the stored result
      errorMessage?: string;
      modelUsed?: string;
      // Optionally include processed content details if creating/updating ProcessedContent here
      processedContent?: {
        transformationType: TransformationType;
        rawChunkId: string; // Assuming input was a chunk
        version: number;    // Need logic to determine next version
        resultLocation?: string;
        resultText?: string;
        embedding?: number[]; // If embedding task
        metadata?: Record<string, any>;
        modelUsed?: string;
      };
      // Optionally include usage details for creating UsageRecord here
      usage?: {
        promptTokens: number;
        completionTokens: number;
        modelUsed: string;
      }
    }
    ```
* **Output:** Type definition file.

**Step 4: Implement Worker Logic (`src/index.ts`)**

* **Action:** Implement the main worker logic, including the queue handler, helper functions for processing, API calls, and error handling. Use the environment variables/bindings configured in `wrangler.toml`.
    ```typescript
    // src/index.ts
    import { AIQueueMessage, UpdateTaskPayload } from './types';

    // Define Env interface based on wrangler.toml bindings/vars
    interface Env {
      ASYNC_QUEUE: Queue; // Binding for the trigger (available in queue handler)
      R2_STORAGE: R2Bucket;
      DATA_SERVICE_URL: string;
      INTERNAL_API_KEY: string; // Secret for API callbacks
      AI_GATEWAY_CF_ENDPOINT: string;
      AI_GATEWAY_OPENAI_ENDPOINT: string;
      // Add other gateway endpoints
    }

    export default {
      async queue(batch: MessageBatch<AIQueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
        for (const message of batch.messages) {
          const task = message.body;
          console.log(`Processing task ${task.taskID} of type ${task.taskType}`);

          try {
            // 1. Update status to PROCESSING immediately
            await updateAsyncTaskStatus(task.taskID, { status: 'PROCESSING', modelUsed: task.modelUsed }, env); // Pass model if known early

            // 2. Fetch Input Data if needed
            let inputText = '';
            if (task.inputData.type === 'text') {
              inputText = task.inputData.value;
            } else if (task.inputData.type === 'r2_path') {
              console.log(`Workspaceing input from R2: ${task.inputData.value}`);
              const object = await env.R2_STORAGE.get(task.inputData.value);
              if (object === null) {
                throw new Error(`Input R2 object not found: ${task.inputData.value}`);
              }
              inputText = await object.text(); // Assuming text input, handle binary if needed
              console.log(`Workspaceed ${inputText.length} characters from R2.`);
            } else {
              throw new Error(`Invalid inputData type: ${task.inputData.type}`);
            }

            // --- TODO: Implement Core AI Processing Logic ---
            // 3. Select AI Provider (reuse/adapt logic from ai-handler-worker)
            const selectedProvider = selectProvider(task);

            // 4. Translate Request (reuse/adapt logic)
            const providerRequest = translateRequest(task, inputText, selectedProvider);
            const gatewayUrl = getGatewayUrl(selectedProvider, env);

            // 5. Call AI Gateway
            console.log(`Calling AI Gateway (${selectedProvider}) for task ${task.taskID}`);
            const gatewayResponse = await fetch(gatewayUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Add Authorization header if gateway requires it (separate from internal API key)
              },
              body: JSON.stringify(providerRequest),
            });

            if (!gatewayResponse.ok) {
              const errorText = await gatewayResponse.text();
              throw new Error(`AI Gateway request failed (${gatewayResponse.status}): ${errorText}`);
            }
            const providerResult = await gatewayResponse.json();

            // 6. Translate Response (reuse/adapt logic)
            const processedResult = translateResponse(providerResult, selectedProvider);

            // --- TODO: Handle Result Storage and Final Update ---
            // 7. Store Result in R2
            const resultKey = `${task.customerID}/processed/${task.taskID}/result.json`; // Or .txt, .bin based on output
            await env.R2_STORAGE.put(resultKey, JSON.stringify(processedResult.outputData)); // Store structured data
            console.log(`Stored result for task ${task.taskID} at R2 path: ${resultKey}`);

            // 8. Prepare Final Update Payload (including Usage if available from response headers/body)
            const updatePayload: UpdateTaskPayload = {
              status: 'COMPLETED',
              resultLocation: resultKey,
              modelUsed: selectedProvider, // Or more specific model from response?
              // Example: Extract usage if possible (depends heavily on provider response)
              // usage: {
              //   promptTokens: processedResult.usage?.prompt_tokens || 0,
              //   completionTokens: processedResult.usage?.completion_tokens || 0,
              //   modelUsed: processedResult.model || selectedProvider,
              // },
              // Example: Include ProcessedContent details if creating it via callback
              // processedContent: { ... }
            };

            // 9. Update AsyncTask status to COMPLETED
            await updateAsyncTaskStatus(task.taskID, updatePayload, env);
            console.log(`Task ${task.taskID} completed successfully.`);

            // 10. Acknowledge message
            message.ack();

          } catch (error: any) {
            console.error(`Error processing task ${task.taskID}:`, error);
            // Update task status to ERROR
            try {
              await updateAsyncTaskStatus(task.taskID, { status: 'ERROR', errorMessage: error.message || 'Unknown error' }, env);
            } catch (updateError) {
              console.error(`Failed to update task ${task.taskID} status to ERROR:`, updateError);
            }

            // Decide whether to retry or dead-letter based on error type / retries
            // For simplicity, just acking failure here, relies on Queue's native retries
            // Consider explicit retry logic or dead-lettering for specific errors
             message.ack(); // Ack after marking as error to prevent infinite loops if update fails
            // OR message.retry({delaySeconds: ...}) for specific transient errors
          }
        }
      },
    };

    // --- Helper Functions ---

    async function updateAsyncTaskStatus(taskId: string, payload: Partial<UpdateTaskPayload>, env: Env): Promise<void> {
      const url = `${env.DATA_SERVICE_URL}/tasks/${taskId}`; // Ensure this endpoint exists in NestJS
      console.log(`Updating task ${taskId} status via ${url} with status ${payload.status}`);
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-API-Key': env.INTERNAL_API_KEY, // Use the secret API key
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update task status (${response.status}): ${errorText}`);
        }
        console.log(`Successfully updated task ${taskId} status.`);
      } catch (error) {
        console.error(`Error calling updateAsyncTaskStatus for task ${taskId}:`, error);
        throw error; // Re-throw to be caught by main handler
      }
    }

    // --- Placeholder/TODO: Implement/Adapt these functions ---
    function selectProvider(task: AIQueueMessage): string {
      // Adapt logic from Task 2.3 of ai-handler-worker description
      // Based on task.taskType, task.providerPreference
      console.log(`Selecting provider for ${task.taskType}... (using default openai)`);
      return task.providerPreference || 'openai'; // Example default
    }

    function getGatewayUrl(provider: string, env: Env): string {
      if (provider === 'cloudflare') return env.AI_GATEWAY_CF_ENDPOINT;
      if (provider === 'openai') return env.AI_GATEWAY_OPENAI_ENDPOINT;
      // Add other providers
      throw new Error(`Invalid provider selected: ${provider}`);
    }

    function translateRequest(task: AIQueueMessage, inputText: string, provider: string): any {
      // Adapt logic from Task 2.3
      console.log(`Translating request for ${provider}...`);
      // Example for a generic chat completion format
      return {
        // Provider specific fields based on 'provider' and 'task.taskType'
        messages: [{ role: 'user', content: `Perform ${task.taskType} on: ${inputText}` }],
        // Include options: task.options
      };
    }

    interface ProcessingResult {
        outputData: any; // The main result payload
        usage?: { prompt_tokens?: number; completion_tokens?: number; }; // Optional usage info
        model?: string; // Optional specific model identifier from response
    }

    function translateResponse(providerResult: any, provider: string): ProcessingResult {
      // Adapt logic from Task 2.5
      console.log(`Translating response from ${provider}...`);
      // Example: Extract main content and potentially usage info
      return {
        outputData: providerResult.choices?.[0]?.message?.content || providerResult.result || providerResult, // Adapt based on actual provider responses
        usage: providerResult.usage // Pass usage through if available
      };
    }

    ```
* **Output:** Worker script `src/index.ts` and helper files.

**Step 5: Deploy Worker**

* **Action:** Deploy the worker using Wrangler CLI. Make sure secrets (like `INTERNAL_API_KEY`) are set first.
    ```bash
    # Set secrets first (only needs to be done once per secret)
    npx wrangler secret put INTERNAL_API_KEY

    # Deploy the worker
    npx wrangler deploy
    ```
* **Output:** Deployed `ai-queue-worker` connected to the `rko-async-ai-tasks` queue.

**Step 6: NestJS Backend API Endpoint**

* **Action:** Ensure an endpoint exists in your NestJS `Data Management Service` (or a dedicated Task service) that accepts `PATCH /tasks/:taskId` requests. This endpoint should:
    1.  Verify the `X-Internal-API-Key` header against the stored secret value (use a Guard).
    2.  Accept the `UpdateTaskPayload` body.
    3.  Use Prisma Client to find the `AsyncTask` by `taskId`.
    4.  Update the task's `status`, `resultLocation`, `errorMessage`, `modelUsed`.
    5.  **(Crucial):** Implement logic here (or trigger another process) to create/update the corresponding `ProcessedContent` record(s) based on the details in the payload (linking it to the `AsyncTask`).
    6.  **(Optional):** Implement logic here (or trigger another process) to create the `UsageRecord` based on the `usage` details in the payload.
* **Output:** A working and secured API endpoint in NestJS for the worker callbacks.

---

## 3. Revised Full Technical Architecture (Prescriptive)

*(This section integrates the final Prisma schema and the AI Queue Worker plan into the overall architecture document, including code examples/skeletons as discussed.)*

---

**Highly Prescriptive Technical Architecture: Research Knowledge Organizer (RKO) - V2**

**Guiding Principles for the AI Agent:** (Same as before: Strict Adherence, Sequential Execution, Defined Interfaces, Mandated Configuration, Robust Implementation, Context Awareness)

---

**(Phase 0: Project Setup & Foundational Infrastructure)** - *Minor Updates*

* **Goal:** Establish mandatory project structures and Cloudflare configurations.
* **Agent Task 0.1 - 0.6:** (Mostly same as before)
    * Task 0.4: Provision Cloudflare Queue named `rko-async-ai-tasks`. (Confirming name for the *new* AI queue).
    * Task 0.5: Provision Cloudflare KV `rko-rate-limits`.
    * Task 0.6: Provision Cloudflare KV `rko-auth-keys`.
    * **NEW Task 0.7: Provision Cloudflare Queue (Existing - Verification)**
        * **Action:** Verify the name of the *existing* Cloudflare Queue used by the current `Job` system (e.g., `job-queue`). This architecture will *not* modify this queue or its consumers directly.
    * **NEW Task 0.8: Generate Internal API Key**
        * **Action:** Generate a secure secret key (e.g., `openssl rand -hex 32`). This `INTERNAL_API_KEY` will be used by Cloudflare Workers (`ai-queue-worker`) to authenticate callbacks to the NestJS backend. Store this key securely.

---

**(Phase 1: Backend Core Services (NestJS))** - *Significant Updates based on Final Schema*

* **Goal:** Build foundational backend microservices using NestJS and the *finalized* Prisma schema.
* **Location:** `rko-backend` repository.
* **Agent Task 1.1: Initialize NestJS Monorepo with Prisma:** (Same as before)
* **Agent Task 1.2: Implement `Auth Service`:** (Same as before - ensure JWT public key is stored in `rko-auth-keys` KV).
* **Agent Task 1.3: Implement `Data Management Service` (Using Final Schema)**
    * **Action:** Develop `apps/data-service`.
        * Implement Prisma schema changes as detailed in **Part 1** of this response (Add Enums, `Collection`, `ContentTag`, `ContentSourceTag`, `AsyncTask`, Billing Models; Modify `ContentSource`, `RawChunk`; Rename/Modify `ProcessedChunk`->`ProcessedContent`; Modify `WorkspaceContent`; Simplify RBAC if chosen). **Crucially, DO NOT remove the existing `Job` model.**
        * Implement REST endpoints for authenticated CRUD operations on the *new* and *modified* models (`Collection`, `ContentSource`, `RawChunk`, `ProcessedContent`, `AsyncTask`, `ContentTag`, Billing models, etc.). Enforce authorization based on `tenantId` from JWT.
        * Implement `PATCH /tasks/:taskId` endpoint specifically for callbacks from `ai-queue-worker`. Secure this with an `InternalApiKeyGuard` checking the `X-Internal-API-Key` header against the value stored securely (env var/secret management). This endpoint updates `AsyncTask` status/results and **must also handle creation/update of related `ProcessedContent` and potentially `UsageRecord` records.**
        * Implement `GET /pricing/:modelIdentifier` endpoint for `ai-queue-worker` to fetch model pricing. Secure appropriately (internal API key or standard auth).
        * **(Code Skeleton Example - Controller Endpoint):**
            ```typescript
            // data.controller.ts
            import { Controller, Patch, Param, Body, UseGuards, Headers, ForbiddenException, Get } from '@nestjs/common';
            import { DataService } from './data.service';
            import { UpdateTaskPayload } from './dto/update-task.dto'; // Define this DTO
            import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard'; // Implement this guard

            @Controller()
            export class DataController {
              constructor(private readonly dataService: DataService) {}

              @Patch('tasks/:taskId')
              @UseGuards(InternalApiKeyGuard) // Secure this endpoint
              async updateAsyncTask(
                @Param('taskId') taskId: string,
                @Body() updatePayload: UpdateTaskPayload,
              ) {
                return this.dataService.updateAsyncTaskResult(taskId, updatePayload);
              }

              @Get('pricing/:modelIdentifier')
              @UseGuards(InternalApiKeyGuard) // Secure pricing endpoint too
              async getModelPricing(@Param('modelIdentifier') modelIdentifier: string) {
                 return this.dataService.getModelPricing(modelIdentifier);
              }
              // ... other CRUD endpoints for Collections, ContentSources etc.
            }
            ```
        * **(Code Skeleton Example - Service Method):**
            ```typescript
            // data.service.ts
            import { Injectable, NotFoundException } from '@nestjs/common';
            import { PrismaService } from '../prisma/prisma.service'; // Assuming PrismaService setup
            import { UpdateTaskPayload } from './dto/update-task.dto';
            import { AsyncTaskStatus, ProcessedContentStatus } from '@prisma/client'; // Import enums

            @Injectable()
            export class DataService {
              constructor(private prisma: PrismaService) {}

              async updateAsyncTaskResult(taskId: string, payload: UpdateTaskPayload) {
                // Use Prisma transaction for consistency
                return this.prisma.$transaction(async (tx) => {
                  // 1. Update AsyncTask
                  const updatedTask = await tx.asyncTask.update({
                    where: { id: taskId },
                    data: {
                      status: payload.status === 'COMPLETED' ? AsyncTaskStatus.COMPLETED : AsyncTaskStatus.ERROR,
                      resultLocation: payload.resultLocation,
                      errorMessage: payload.errorMessage,
                      modelUsed: payload.modelUsed || undefined, // Ensure modelUsed is updated
                      updatedAt: new Date(),
                    },
                  });

                  if (!updatedTask) {
                    throw new NotFoundException(`AsyncTask with ID ${taskId} not found.`);
                  }

                  // 2. Create/Update ProcessedContent (Example logic - needs refinement based on exact payload)
                  if (payload.status === 'COMPLETED' && payload.processedContent) {
                     // Find related RawChunk based on task input or payload info
                     // const rawChunkId = ...;
                     // Determine version logic
                     // const version = ...;

                     await tx.processedContent.upsert({
                         where: { /* needs unique identifier like combination */
                           rawChunkId_transformationType_version: {
                              rawChunkId: payload.processedContent.rawChunkId,
                              transformationType: payload.processedContent.transformationType,
                              version: payload.processedContent.version
                           }
                         },
                         update: {
                            status: ProcessedContentStatus.COMPLETED,
                            resultLocation: payload.processedContent.resultLocation || payload.resultLocation,
                            resultText: payload.processedContent.resultText,
                            embedding: payload.processedContent.embedding ? Buffer.from(payload.processedContent.embedding) : undefined, // Handle Buffer conversion
                            metadata: payload.processedContent.metadata || undefined,
                            modelUsed: payload.processedContent.modelUsed || updatedTask.modelUsed,
                            asyncTaskId: taskId, // Link back to task
                         },
                         create: {
                            rawChunkId: payload.processedContent.rawChunkId,
                            transformationType: payload.processedContent.transformationType,
                            version: payload.processedContent.version,
                            status: ProcessedContentStatus.COMPLETED,
                            resultLocation: payload.processedContent.resultLocation || payload.resultLocation,
                            resultText: payload.processedContent.resultText,
                            embedding: payload.processedContent.embedding ? Buffer.from(payload.processedContent.embedding) : undefined,
                            metadata: payload.processedContent.metadata || undefined,
                            modelUsed: payload.processedContent.modelUsed || updatedTask.modelUsed,
                            asyncTaskId: taskId,
                         }
                     });
                  }

                  // 3. Create UsageRecord (Example logic)
                  if (payload.status === 'COMPLETED' && payload.usage) {
                     const pricing = await tx.aIModelPricing.findUnique({ where: { modelIdentifier: payload.usage.modelUsed }});
                     const cost = calculateCost(payload.usage, pricing); // Implement cost calculation

                     await tx.usageRecord.create({
                         data: {
                            tenantId: updatedTask.tenantId,
                            asyncTaskId: taskId,
                            // processedContentId: find the ID created above if needed
                            timestamp: new Date(),
                            modelUsed: payload.usage.modelUsed,
                            promptTokens: payload.usage.promptTokens,
                            completionTokens: payload.usage.completionTokens,
                            calculatedCost: cost,
                         }
                     });
                  }

                  return updatedTask;
                });
              }
               async getModelPricing(modelIdentifier: string) {
                  const pricing = await this.prisma.aIModelPricing.findUnique({ where: { modelIdentifier }});
                  if (!pricing) {
                     throw new NotFoundException(`Pricing not found for model ${modelIdentifier}`);
                  }
                  return pricing;
               }
              // ... other service methods
            }

            function calculateCost(usage, pricing): number { /* Implement logic based on tokens and pricing.unit */ return 0; }

            ```
    * **(Code Skeleton Example - API Key Guard):**
        ```typescript
        // internal-api-key.guard.ts
        import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
        import { ConfigService } from '@nestjs/config'; // Assuming use of @nestjs/config

        @Injectable()
        export class InternalApiKeyGuard implements CanActivate {
          constructor(private configService: ConfigService) {}

          canActivate(context: ExecutionContext): boolean {
            const request = context.switchToHttp().getRequest();
            const providedKey = request.headers['x-internal-api-key'];
            const validKey = this.configService.get<string>('INTERNAL_API_KEY'); // Get from env vars

            if (!providedKey || providedKey !== validKey) {
              throw new ForbiddenException('Invalid or missing Internal API Key');
            }
            return true;
          }
        }
        ```
* **Agent Task 1.4: Setup PostgreSQL Database & Run Migrations:** (Same as before - use `prisma migrate dev`).
* **Agent Task 1.5: Provision Qdrant Vector Database Instance:** (Same as before).
* **Agent Task 1.6: Implement `Content Ingestion Service`:** (Update to link `ContentSource` to `collectionId` instead of `projectId`). Ensure it sets `ContentSource` status correctly (e.g., `UPLOADED`). Potentially trigger chunking process here (could be another async job using the *existing* `Job` system or a sync process if fast).

---

**(Phase 2: Cloudflare AI Integration Layer)** - *Major Updates*

* **Goal:** Implement Cloudflare Workers (`ai-handler-worker`, `ai-queue-worker`) and AI Gateway for the *new* AI task system, running parallel to the existing job queue.
* **Location:** `rko-infrastructure` repository.
* **Agent Task 2.1: Define Standardized AI Request/Response Formats:** (Same as before - use TypeScript interfaces `AIRequest`, `AIPendingResponse`, `AICompletedResponse`, `AIErrorResponse`).
* **Agent Task 2.2: Implement Main Cloudflare Worker (`ai-handler-worker`)**
    * **Action:** Implement `ai-handler-worker.ts`.
        * Bindings/Env Vars: `AUTH_KEYS_KV`, `RATE_LIMIT_KV`, `ASYNC_QUEUE` (bound to **`rko-async-ai-tasks`**), `AUTH_SERVICE_URL`, `DATA_SERVICE_URL`.
        * Auth: Validate JWT using `jose` and public key from `AUTH_KEYS_KV`.
        * Request Parsing/Validation: Parse `AIRequest`.
        * Rate Limiting: Implement using `RATE_LIMIT_KV`.
        * Task Routing: Determine Sync/Async.
        * **If Async:**
            1.  Generate `taskID` (UUID).
            2.  Call `DATA_SERVICE_URL` (`POST /tasks`) via `Workspace` (authenticated, perhaps needs M2M token or reuse user token?) to create `AsyncTask` record with status `PENDING`. **Crucially, include `tenantId` and `userId`**.
            3.  Send message (`AIRequest` payload + `taskID`) to `env.ASYNC_QUEUE` (which is **`rko-async-ai-tasks`**).
            4.  Return `AIPendingResponse` with `taskID`.
        * **If Sync:** Proceed to Provider Selection/Gateway Call/Response Handling (Tasks 2.3, 2.4, 2.5).
    * **(Code Skeleton Example):** Include skeleton code similar to the previous discussion, emphasizing the async path creating the `AsyncTask` record via API call *before* sending to the queue.
* **Agent Task 2.3: Implement Provider Selection & Standardization (in `ai-handler-worker`)** (Same as before - synchronous path).
* **Agent Task 2.4: Configure Cloudflare AI Gateway:** (Same as before - ensure logging captures `customerID`).
* **Agent Task 2.5: Implement Response Handling & Translation (in `ai-handler-worker`)** (Same as before - synchronous path).
* **NEW Agent Task 2.6: Implement AI Queue Consumer Worker (`ai-queue-worker`)**
    * **Action:** Implement the `ai-queue-worker` as detailed in **Part 2** of this response.
        * Use TypeScript.
        * Configure `wrangler.toml` with bindings (`rko-async-ai-tasks` consumer, `R2_STORAGE`) and secrets/vars (`DATA_SERVICE_URL`, `INTERNAL_API_KEY`, AI Gateway URLs).
        * Implement `queue` handler logic: Update status to `PROCESSING` (via PATCH to NestJS using `INTERNAL_API_KEY`), fetch data, select provider, translate request, call AI Gateway, translate response, store result in R2, update status to `COMPLETED`/`ERROR` (via PATCH to NestJS). Ensure the callback payload includes details needed for NestJS to update `ProcessedContent` and `UsageRecord`.
    * **(Code Skeleton Example):** Include the detailed skeleton code provided in Part 2.

---

**(Phase 3: Frontend Application (Remix))** - *Minor Updates*

* **Goal:** Build the user-facing web application.
* **Agent Task 3.1 - 3.6:** (Mostly same as before)
    * Ensure API calls interact with the finalized backend schema (Collections, updated content models).
    * Task 3.5 (AI Interaction): Confirm client-side `Workspace` calls go to the `ai-handler-worker`. Polling logic checks `GET DATA_SERVICE_URL/tasks/:taskId` for `AsyncTask` status.

---

**(Phase 4: Companion Application (Electron))** - *No Major Changes Needed to this Phase based on Queue decision*

* **Goal:** Build the local application.
* **Agent Task 4.1 - 4.5:** (Same as before - interactions with backend APIs need to align with the final schema).

---

**(Phase 5: Advanced Features & Refinements)** - *Updates needed*

* **Goal:** Add collaboration, advanced search, export, and polish.
* **Agent Task 5.1: Implement `Collaboration Service` (Backend):** (Same as before).
* **Agent Task 5.2: Integrate Real-time Collaboration (Frontend):** (Same as before).
* **Agent Task 5.3: Implement Vector Embedding & Search:**
    * **Action:** Update this task to use the final models and async flow:
        * Triggering: Content Ingestion or modification triggers an *asynchronous* AI task via `ai-handler-worker` (`taskType: 'embedding'`, `inputData` points to `RawChunk` ID or R2 path). An `AsyncTask` record is created.
        * Processing (`ai-queue-worker`): Handles the `embedding` task. Gets embedding vector from AI Gateway. Stores embedding result (either in `ProcessedContent.embedding` Bytes field directly, or `ProcessedContent.resultLocation` pointing to a file in R2). Updates `AsyncTask` to `COMPLETED`.
        * Storing (`Data Service` - *modification needed in callback logic*): The `PATCH /tasks/:taskId` callback endpoint in NestJS, when handling a completed embedding task, needs to:
            1.  Find the corresponding `ProcessedContent` record.
            2.  Retrieve the embedding (either directly from `ProcessedContent.embedding` if stored there, or by fetching from `ProcessedContent.resultLocation` in R2).
            3.  Use Qdrant client (`@qdrant/js-client-rest`) to upsert the vector into the Qdrant collection (e.g., `rko_content`). The vector payload *must* include identifiers linking back to the `RawChunk.id` and `ContentSource.id`, plus `tenantId`, `collectionId`.
        * Searching (`Data Service`): Endpoint `POST /search/semantic` (same as before - gets query embedding via *sync* call to `ai-handler-worker`, searches Qdrant, filters by tenant/collection, returns `RawChunk`/`ContentSource` IDs).
        * Frontend: (Same as before).
* **Agent Task 5.4: Implement `Export Service` (Backend):** (Adapt to use final `WorkspaceContent`/`ProcessedContent` models). Consider if export itself should be an async job (using the *existing* `Job` system if complex/long-running).
* **Agent Task 5.5: Implement Export UI (Frontend):** (Same as before).

---

**(Phase 6: Security, Deployment & Monitoring)** - *Minor Updates*

* **Goal:** Harden security, define deployment, setup observability.
* **Agent Task 6.1: Implement RBAC Enforcement:** (Update to reflect *simplified* RBAC using `TenantRole` and `WorkspaceRole` if that path was chosen. Ensure NestJS Guards check these roles).
* **Agent Task 6.2: Implement R2 Tenant Isolation:** (Same as before - ensure `tenantId` prefixing).
* **Agent Task 6.3: Setup Logging and Monitoring:** (Same as before - ensure both worker types and NestJS services are covered).
* **Agent Task 6.4: Containerize Backend Services:** (Same as before).
* **Agent Task 6.5: Implement Prescribed Deployment Strategy:**
    * **Action:** Update deployment steps:
        * Deploy *both* `ai-handler-worker` and `ai-queue-worker` using Wrangler CLI. Manage secrets (`INTERNAL_API_KEY`, etc.) and bindings (`rko-async-ai-tasks` queue, R2, KV).
        * Deploy NestJS backend (ensure `INTERNAL_API_KEY` is securely configured via env var/secret for the `InternalApiKeyGuard`).
        * Deploy Frontend, Databases (same).
        * Update CI/CD pipelines for both workers.
    * **Output:** Updated deployment documentation and CI/CD scripts.

