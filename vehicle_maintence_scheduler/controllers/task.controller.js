const taskService = require('../services/task.service');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { Log } = require('logging_middleware');
const { optimizeTasks } = require('../utils/optimization');

const getAllTasks = async (req, res) => {
    try {
        const data = await taskService.getAll();
        Log('backend', 'info', 'controller', 'Fetched all maintenance tasks');
        return sendSuccess(res, 200, data, 'Tasks retrieved successfully');
    } catch (error) {
        return sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Error fetching tasks: ${error.message}`);
    }
};

const createTask = async (req, res) => {
    try {
        // Safe check for req.body existence
        if (!req.body) {
            return sendError(res, 400, 'Request body is empty or malformed', 'backend', 'warn', 'controller', 'Missing request body');
        }

        const { name, duration, impact } = req.body;

        // Strict Validation
        if (!name || duration === undefined || impact === undefined) {
            // Hardcode 400 status return directly just to ensure Postman catches it safely
            return sendError(res, 400, 'Name, duration, and impact are required', 'backend', 'warn', 'controller', 'Missing fields for task creation');
        }

        const data = await taskService.create({ name, duration, impact });
        Log('backend', 'info', 'controller', `Created new maintenance task ID: ${data.id}`);
        return sendSuccess(res, 201, data, 'Task created successfully');
    } catch (error) {
        return sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Error creating task: ${error.message}`);
    }
};

const optimize = async (req, res) => {
    try {
        Log('backend', 'info', 'controller', 'Task optimization request started');

        if (!req.body) {
            return sendError(res, 400, 'Request body is missing', 'backend', 'warn', 'controller', 'Missing request body');
        }

        let { maxHours } = req.body;

        if (maxHours !== undefined) {
            maxHours = Number(maxHours);
        }

        if (maxHours === undefined || isNaN(maxHours)) {
            return sendError(res, 400, 'maxHours number is required in the body', 'backend', 'warn', 'controller', 'Optimization validation failed: Invalid maxHours');
        }

        const tasks = await taskService.getAll();
        
        if (tasks.length === 0) {
            return sendError(res, 400, 'No tasks available to optimize', 'backend', 'warn', 'controller', 'Optimization failed: No tasks in system');
        }

        const result = optimizeTasks(tasks, maxHours);

        Log('backend', 'info', 'controller', `Optimization successful: Selected ${result.selectedTasks.length} tasks, Total Impact: ${result.totalImpact}`);
        return sendSuccess(res, 200, result, 'Optimization completed successfully');
    } catch (error) {
        return sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Optimization unexpected error: ${error.message}`);
    }
};

module.exports = { getAllTasks, createTask, optimize };
