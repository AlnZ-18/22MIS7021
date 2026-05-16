/**
 * Stage 6: Priority Inbox Logic
 * 
 * Computes notification priority based on type weight and recency.
 */

// Sample Data (Simulating a database fetch)
const sampleNotifications = [
    { id: 'N1', type: 'academic', isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() }, // 2 hours ago
    { id: 'N2', type: 'general', isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString() }, // 10 minutes ago
    { id: 'N3', type: 'placement', isRead: true, createdAt: new Date().toISOString() }, // Now (Read, should be ignored)
    { id: 'N4', type: 'placement', isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }, // 1 day ago
    { id: 'N5', type: 'event', isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() } // 30 minutes ago
];

// Configuration for Type Weights
const TYPE_WEIGHTS = {
    'placement': 100,
    'academic': 80,
    'event': 40,
    'general': 10
};

/**
 * Calculates a dynamic priority score for a notification.
 * Priority = Type Weight + Recency Bonus
 * Recency Bonus decays over time to naturally lower old notifications.
 * 
 * @param {Object} notification 
 * @returns {number} Score
 */
function calculatePriorityScore(notification) {
    const baseWeight = TYPE_WEIGHTS[notification.type] || 0;
    
    // Recency: calculate age in hours
    const hoursOld = (Date.now() - new Date(notification.createdAt).getTime()) / (1000 * 60 * 60);
    
    // Recency bonus: max 50 points, decays by 1 point per hour
    const recencyBonus = Math.max(0, 50 - hoursOld);
    
    return baseWeight + recencyBonus;
}

/**
 * Retrieves the Top N priority unread notifications.
 * 
 * Time Complexity Analysis:
 * - Filtering unread: O(N) where N is total notifications.
 * - Computing scores: O(U) where U is unread notifications.
 * - Sorting: O(U log U) using standard sorting.
 * - Overall Time Complexity: O(N log N) bounded by sorting.
 * 
 * Note: For massive arrays (e.g., U > 10,000), utilizing a Min-Heap of size K
 * would optimize sorting to O(U log K). However, since we pre-filter to 'unread' 
 * and typically run this on small, paginated user sets, standard JS sort is 
 * highly efficient and avoids overengineering.
 * 
 * @param {Array} notifications - List of raw notifications
 * @param {number} topN - Number of top notifications to return
 * @returns {Array} Sorted top N notifications
 */
function getPriorityInbox(notifications, topN = 5) {
    // Minimal Validation
    if (!Array.isArray(notifications)) {
        throw new Error('Invalid input: notifications must be an array');
    }
    if (typeof topN !== 'number' || topN <= 0) {
        throw new Error('Invalid input: topN must be a positive integer');
    }

    try {
        // 1. Filter out read notifications
        const unread = notifications.filter(n => n.isRead === false);

        // 2. Compute dynamic scores
        const scored = unread.map(n => ({
            ...n,
            priorityScore: calculatePriorityScore(n)
        }));

        // 3. Sort descending by score
        scored.sort((a, b) => b.priorityScore - a.priorityScore);

        // 4. Return top N slice
        return scored.slice(0, topN);
        
    } catch (error) {
        console.error('Error computing priority inbox:', error.message);
        return [];
    }
}

// ==========================================
// Execution / Testing
// ==========================================

// Run only if executed directly (not required as a module)
if (require.main === module) {
    console.log("Processing Priority Inbox...\n");
    
    // Request top 3
    const topNotifications = getPriorityInbox(sampleNotifications, 3);
    
    console.log(`Top ${topNotifications.length} Priority Unread Notifications:`);
    topNotifications.forEach((n, index) => {
        const ageMins = Math.round((Date.now() - new Date(n.createdAt).getTime()) / (1000 * 60));
        console.log(`${index + 1}. [${n.type.toUpperCase()}] ID: ${n.id} | Score: ${n.priorityScore.toFixed(2)} | Age: ${ageMins} mins`);
    });
}

module.exports = { getPriorityInbox, calculatePriorityScore };
