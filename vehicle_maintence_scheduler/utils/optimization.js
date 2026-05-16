/**
 * Selects the optimal combination of maintenance tasks to maximize total impact
 * without exceeding the maximum available mechanic hours.
 * 
 * Uses a classic 0/1 Knapsack Dynamic Programming approach.
 * 
 * @param {Array} tasks - Array of objects: { id, name, duration, impact }
 * @param {number} maxHours - Maximum available mechanic hours (must be an integer)
 * @returns {Object} { selectedTasks, totalImpact, totalUsedHours }
 */
function optimizeTasks(tasks, maxHours) {
    const n = tasks.length;
    
    // dp[i][w] will store the maximum impact using the first i tasks within w hours
    const dp = Array.from({ length: n + 1 }, () => Array(maxHours + 1).fill(0));

    // Build the DP table
    for (let i = 1; i <= n; i++) {
        const currentTask = tasks[i - 1];
        
        for (let w = 1; w <= maxHours; w++) {
            // Check if the current task can fit in the remaining capacity 'w'
            if (currentTask.duration <= w) {
                // Choose the maximum between including the task or excluding it
                dp[i][w] = Math.max(
                    dp[i - 1][w], // Exclude
                    dp[i - 1][w - currentTask.duration] + currentTask.impact // Include
                );
            } else {
                // Task duration is larger than current capacity 'w', cannot include
                dp[i][w] = dp[i - 1][w];
            }
        }
    }

    // Backtrack through the DP table to find exactly which tasks were selected
    let currentImpact = dp[n][maxHours];
    let currentCapacity = maxHours;
    const selectedTasks = [];
    let totalUsedHours = 0;

    for (let i = n; i > 0 && currentImpact > 0; i--) {
        // If the impact is the same as the cell directly above it, 
        // it means this task was NOT included in the optimal solution.
        if (currentImpact === dp[i - 1][currentCapacity]) {
            continue;
        } else {
            // The task WAS included
            const task = tasks[i - 1];
            selectedTasks.push(task);
            
            // Deduct its impact and duration to backtrack further
            currentImpact -= task.impact;
            currentCapacity -= task.duration;
            totalUsedHours += task.duration;
        }
    }

    // Reverse the selected tasks so they are generally in the original top-down order
    selectedTasks.reverse();

    return {
        selectedTasks,
        totalImpact: dp[n][maxHours],
        totalUsedHours
    };
}

module.exports = { optimizeTasks };
