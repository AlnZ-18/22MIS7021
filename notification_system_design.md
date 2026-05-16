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
