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
