# Notification System Architecture Design

## Stage 1: API Design & Realtime Integration

This document outlines the REST APIs and realtime connection strategy for the campus notification platform. All endpoints assume standard `Bearer {Token}` authorization.

### 1. Send Notification
Publishes a notification to a specific user, a group, or a campus-wide broadcast.

*   **Endpoint:** `/api/notifications/send`
*   **Method:** `POST`
*   **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
*   **Request Body:**
    ```json
    {
      "targetUserId": "U1023",     // Null/omitted for broadcasts
      "targetGroupId": null,       // e.g., "computer-science-dept"
      "title": "Exam Schedule Updated",
      "message": "The mid-term exam for CS101 has been moved to Friday.",
      "priority": "high",          // low, normal, high
      "type": "academic"
    }
    ```
*   **Response Body (201 Created):**
    ```json
    {
      "success": true,
      "notificationId": "N98214"
    }
    ```

### 2. Fetch Notifications
Retrieves a paginated list of notifications for the authenticated user.

*   **Endpoint:** `/api/notifications`
*   **Method:** `GET`
*   **Headers:** `Authorization: Bearer <token>`
*   **Query Params:** `?page=1&limit=20&unreadOnly=true`
*   **Response Body (200 OK):**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "N98214",
          "title": "Exam Schedule Updated",
          "message": "The mid-term exam for CS101 has been moved to Friday.",
          "priority": "high",
          "type": "academic",
          "isRead": false,
          "createdAt": "2026-05-16T10:00:00Z"
        }
      ],
      "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalItems": 95
      }
    }
    ```

### 3. Mark Notification as Read
Updates the `isRead` status of a specific notification.

*   **Endpoint:** `/api/notifications/:id/read`
*   **Method:** `PATCH`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:** None
*   **Response Body (200 OK):**
    ```json
    {
      "success": true,
      "message": "Notification marked as read."
    }
    ```

### 4. Delete Notification
Soft-deletes or hides a notification from the user's view.

*   **Endpoint:** `/api/notifications/:id`
*   **Method:** `DELETE`
*   **Headers:** `Authorization: Bearer <token>`
*   **Request Body:** None
*   **Response Body (200 OK):**
    ```json
    {
      "success": true,
      "message": "Notification removed successfully."
    }
    ```

---

## Realtime Integration Approach: Server-Sent Events (SSE)

For a campus notification platform, **Server-Sent Events (SSE)** is the recommended approach over WebSockets for delivering realtime alerts.

**Why SSE?**
*   **Unidirectional Flow:** Notifications inherently flow from Server to Client. SSE natively supports this over standard HTTP without the overhead of the bi-directional WebSocket protocol.
*   **Built-in Reconnection:** The browser's native `EventSource` API automatically handles reconnections (e.g., if a student drops off the campus Wi-Fi temporarily).
*   **Scalability:** SSE operates over standard HTTP/1.1 or HTTP/2, making it drastically easier to scale, load-balance, and pass through campus firewalls/proxies compared to stateful WebSockets.

**Implementation Flow:**
1.  **Connection:** Client opens an `EventSource` connection to `GET /api/notifications/stream`.
2.  **Keep-Alive:** Server validates the auth token, keeps the connection open (`Content-Type: text/event-stream`), and pushes lightweight heartbeat pings to prevent timeout.
3.  **Event Push:** When `POST /api/notifications/send` is triggered, a background worker publishes the JSON payload directly to the active SSE stream of the targeted user(s).

---

## Stage 2: Database Architecture & Scaling

### Database Selection: PostgreSQL
**PostgreSQL** is the ideal persistent database for the campus notification platform.
*   **Why Chosen:** Notifications map directly to relational structures (Users ⟷ Notifications). PostgreSQL provides strong ACID compliance, ensuring no dropped or duplicate alerts. Furthermore, its native `JSONB` support allows us to attach flexible metadata payloads (e.g., varying course IDs or event links) without altering the strict schema.

### Schema Design

**Table:** `notifications`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY | Unique identifier for the notification |
| `user_id` | VARCHAR(50) | NOT NULL, FK | Target recipient's campus ID |
| `title` | VARCHAR(255) | NOT NULL | Brief headline |
| `message` | TEXT | NOT NULL | Full notification content |
| `priority` | VARCHAR(20) | DEFAULT 'normal' | Severity (e.g., low, normal, high) |
| `is_read` | BOOLEAN | DEFAULT FALSE | Read/unread status flag |
| `is_deleted`| BOOLEAN | DEFAULT FALSE | Soft delete flag |
| `created_at`| TIMESTAMPTZ | DEFAULT NOW() | Timestamp for chronological sorting |

#### Indexing Strategy
To ensure blazing fast queries for thousands of students simultaneously fetching notifications:
1.  **Composite Index** on `(user_id, created_at DESC)`: Optimizes the primary query of fetching the most recent notifications for a specific user.
2.  **Partial Index** on `user_id` WHERE `is_read = FALSE`: Drastically speeds up "unread count" badge queries without scanning read notifications.

### Scaling Strategies
As notification volume grows significantly across semesters:
1.  **Cursor-Based Pagination:** Instead of slow `OFFSET` queries, the GET API will use cursor pagination (fetching `WHERE created_at < last_seen_timestamp`), preventing database degradation on deep scrolls.
2.  **Time-Based Partitioning:** The `notifications` table can be partitioned by month. Old partitions (e.g., older than 6 months) can be automatically moved to cold storage or archived, keeping the active table highly performant.

### Sample SQL Queries

#### 1. Fetching Notifications (Paginated & Unread Only)
```sql
SELECT id, title, message, priority, created_at 
FROM notifications 
WHERE user_id = 'U1023' 
  AND is_read = FALSE 
  AND is_deleted = FALSE 
ORDER BY created_at DESC 
LIMIT 20;
```

#### 2. Marking a Notification as Read
```sql
UPDATE notifications 
SET is_read = TRUE 
WHERE id = 'N98214' 
  AND user_id = 'U1023';
```

#### 3. Deleting a Notification (Soft Delete)
```sql
UPDATE notifications 
SET is_deleted = TRUE 
WHERE id = 'N98214' 
  AND user_id = 'U1023';
```

---

## Stage 3: Query Optimization & Performance Analysis

### Analyzing the Problematic Query
**Original Query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

#### Why it becomes slow at scale:
Without appropriate indexes, the database must perform a **Full Table Scan**, examining every single row in the millions-large `notifications` table to check the `studentID` and `isRead` conditions. After finding the rows, it must perform an expensive, memory-intensive sorting operation for the `ORDER BY createdAt DESC` clause before returning data.

#### Why `SELECT *` is inefficient:
`SELECT *` forces the database to retrieve every column from disk into memory, including potentially large payload bodies or unused metadata. This unnecessarily spikes memory consumption, increases disk I/O operations, and bloats network payload latency. Explicitly selecting only required columns is highly recommended.

#### Why indexing every column is a bad idea:
**Write Penalty & Storage Bloat:** While indexes speed up reads, they drastically slow down writes. Every `INSERT`, `UPDATE`, or `DELETE` to the `notifications` table forces the database engine to synchronously update every single index attached to those columns. Over-indexing creates severe write latency and doubles/triples storage costs.

---

### Recommended Optimization Strategy

#### 1. Proper Indexing Strategy: Composite Indexes
A **Composite Index** is an index that spans multiple columns. By ordering the columns correctly inside the index structure, the database can simultaneously filter the data and instantly return it in sorted order without doing an in-memory sort.

**Recommended Index:**
```sql
CREATE INDEX idx_student_unread_date ON notifications (studentID, isRead, createdAt DESC);
```
**Mechanism:** The engine jumps directly to the node for `studentID = 1042`, filters down the continuous block of `isRead = false`, and reads them out natively sorted by `createdAt DESC`.

#### 2. The Optimized Query
```sql
SELECT id, title, type, createdAt 
FROM notifications
WHERE studentID = 1042 
  AND isRead = false 
  AND createdAt < '2026-05-16T10:00:00Z' -- Keysets/Cursor logic
ORDER BY createdAt DESC
LIMIT 20;
```

#### 3. Pagination Approach (Cursor-Based)
*   **Avoid `OFFSET`:** `OFFSET 1000` forces the database to physically scan and discard 1,000 rows.
*   **Use Cursor Pagination:** Using `WHERE createdAt < last_seen_timestamp` combined with a `LIMIT` leverages the composite index to fetch the exact next block of 20 rows in $O(1)$ lookup time, regardless of how deep the user scrolls.

#### 4. Caching Considerations
*   **Unread Badge Counts:** Counting unread notifications via SQL is expensive at high volumes. Store the `unread_count` per student in an in-memory cache like **Redis**.
*   **Invalidation Flow:** Increment the Redis key when a new notification is fired; decrement it when a notification is marked read. The actual database is only queried when the student explicitly opens their notification tray.

---

### Additional Query: Recent Placement Notifications
**Task:** Find all students who received "placement" notifications in the last 7 days.
```sql
SELECT DISTINCT studentID
FROM notifications
WHERE type = 'placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```
*(Note: To execute this efficiently at scale, a secondary composite index on `(type, createdAt)` would be required).*

---

## Stage 4: High-Load Performance & Scalability

When the notification system experiences heavy traffic (e.g., a massive campus-wide broadcast causing thousands of simultaneous database queries), the database can become a severe bottleneck. Below are practical strategies to alleviate database pressure and maintain system speed.

### 1. Redis Caching
Instead of repeatedly hitting the PostgreSQL database to calculate the "Unread Count" every time a student loads a page, we cache this value in Redis.
*   **Mechanism:** Store a key like `unread:U1023` mapped to an integer. Increment it on new notifications; decrement when a notification is read.
*   **Tradeoffs:** 
    *   *Pros:* Eliminates over 80% of database read load, as the unread badge is the most frequently requested data. Responses are sub-millisecond.
    *   *Cons:* Introduces cache invalidation complexity. If Redis crashes, the cache must be rebuilt from the primary database.

### 2. Pagination / Lazy Loading
We never send all historical notifications to the client at once. 
*   **Mechanism:** We implement **Cursor-Based Pagination** to send data in small chunks (e.g., 20 at a time). When the user scrolls to the bottom of the list, the frontend requests the next batch using the `createdAt` timestamp of the last viewed notification.
*   **Tradeoffs:**
    *   *Pros:* Keeps memory usage low on both the server and client, drastically reducing network payloads and database scan times.
    *   *Cons:* Slightly more complex to implement on the frontend and backend compared to basic `OFFSET` pagination.

### 3. Server-Sent Events (SSE) vs. WebSockets
Instead of having thousands of clients constantly sending HTTP requests (polling) to check for new notifications, we stream updates to them.
*   **Mechanism:** We utilize **Server-Sent Events (SSE)** because notifications are fundamentally a unidirectional flow (Server ➔ Client).
*   **Tradeoffs:**
    *   *Pros:* Eliminates empty polling requests that exhaust database connections. SSE is drastically lighter on server memory than maintaining full, stateful two-way WebSocket connections.
    *   *Cons:* Requires long-lived HTTP connections, which can consume proxy or load balancer connection limits if not tuned properly.

### 4. Read Replicas
When `SELECT` queries overwhelm the database (e.g., thousands of students opening their notification trays simultaneously), we scale horizontally.
*   **Mechanism:** Deploy a primary PostgreSQL instance dedicated to writes (`INSERT`, `UPDATE`), and asynchronously stream data to multiple Read Replica instances. All `GET` requests are routed exclusively to the replicas.
*   **Tradeoffs:**
    *   *Pros:* Linearly scales read capacity without blocking critical write operations.
    *   *Cons:* Introduces **replication lag**. A user might mark a notification as read (hitting the primary), immediately refresh the page (hitting a replica), and temporarily see it as unread.

### 5. Archival of Old Notifications
Notification tables grow infinitely. Queries against massive tables degrade over time, even with proper indexes.
*   **Mechanism:** Run a nightly automated job to move notifications older than 6 months from the hot `notifications` table into a separate `notifications_archive` table, or use PostgreSQL's native table partitioning by date.
*   **Tradeoffs:**
    *   *Pros:* Keeps the primary table extremely lean, meaning active indexes fit entirely into RAM, ensuring blazing-fast reads.
    *   *Cons:* If a user attempts to view a 2-year-old notification, the application logic must intelligently query the slower archive table.

---

## Stage 5: Large-Scale Asynchronous Processing

Sending a campus-wide broadcast to 50,000 students synchronously (e.g., looping through 50,000 records and firing database inserts/email requests in a single HTTP request) will lead to severe API timeouts, exhausted memory, and blocked server threads. **Asynchronous processing** is completely mandatory to decouple the immediate API response from the heavy workload of delivery.

### Architecture Components

#### 1. Message Queues (e.g., RabbitMQ, AWS SQS)
Instead of processing immediately, the `POST /api/notifications/send` API instantly pushes a single "broadcast job" payload into a Message Queue and immediately returns a `202 Accepted` response.
*   **Role:** Acts as a highly durable buffer. It securely holds the jobs until backend worker processes are ready to handle them, ensuring no broadcasts are lost during traffic spikes.

#### 2. Worker Processes & Batching
Independent backend Node.js worker instances continually listen to the queue.
*   **Role:** A worker pulls the broadcast job, fetches the target 50,000 `studentIDs`, and breaks them into manageable chunks (e.g., batches of 1,000).
*   **Batching:** It executes bulk `INSERT` statements into PostgreSQL (to create the in-app notifications) and triggers bulk email API requests, drastically reducing database round-trips.

### Handling Failures & Fault Tolerance

#### 3. Retry Mechanisms & Exponential Backoff
If an external email provider's API goes down or rate-limits our requests, the worker must not silently fail and discard the batch.
*   **Exponential Backoff:** The worker catches the failure and requeues the specific batch with an exponentially increasing delay (e.g., retry in 2s, then 4s, then 8s). This ensures eventual delivery without aggressively hammering a struggling third-party service.

#### 4. Dead-Letter Queues (DLQ)
If a specific batch fails repeatedly (e.g., exceeding 5 retries due to a permanently invalid payload or hard API rejection), it is routed to a **Dead-Letter Queue**.
*   **Role:** The DLQ acts as a quarantine zone. It ensures the main queue doesn't get clogged with unprocessable "poison" messages, allowing developers to manually inspect and replay the failed jobs later.

### Observability & Integration

#### 5. Logging and Monitoring (Integration)
To maintain total visibility into this distributed, multi-stage process, we integrate our custom **`Log()` middleware** across the entire pipeline:

*   **API Layer:** `Log('backend', 'info', 'api', 'Broadcast triggered for 50k users')`
*   **Worker Layer:** `Log('worker', 'info', 'queue-processor', 'Batch 1/50 processed successfully')`
*   **Failure Catching:** `Log('worker', 'error', 'email-service', 'SendGrid timeout, retrying in 4s...')`
*   **DLQ Routing:** `Log('worker', 'warn', 'dlq-router', 'Batch permanently failed, moved to DLQ')`

By centralizing these logs, we achieve high fault tolerance. If a worker process unexpectedly crashes mid-execution, the queue will safely reassign the unacknowledged batch to another healthy worker. Meanwhile, the logging middleware ensures developers can instantly track where bottlenecks or failures occurred during the massive 50k broadcast.
