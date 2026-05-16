const vehicleService = require('../services/vehicle.service');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { Log } = require('logging_middleware');
const { optimizeTasks } = require('../utils/optimization');

const getAllVehicles = async (req, res) => {
    try {
        const data = await vehicleService.getAll();
        Log('backend', 'info', 'controller', 'Fetched all vehicles');
        sendSuccess(res, 200, data, 'Vehicles retrieved successfully');
    } catch (error) {
        sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Error fetching vehicles: ${error.message}`);
    }
};

const getVehicleById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await vehicleService.getById(id);

        if (!data) {
            return sendError(res, 404, 'Vehicle not found', 'backend', 'warn', 'controller', `Vehicle not found with ID: ${id}`);
        }

        Log('backend', 'info', 'controller', `Fetched vehicle ID: ${id}`);
        sendSuccess(res, 200, data, 'Vehicle retrieved successfully');
    } catch (error) {
        sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Error fetching vehicle by ID: ${error.message}`);
    }
};

const createVehicle = async (req, res) => {
    try {
        const { make, model, year, lastMaintenanceDate } = req.body;

        if (!make || !model || !year) {
            return sendError(res, 400, 'Make, model, and year are required', 'backend', 'warn', 'controller', 'Missing fields for vehicle creation');
        }

        const data = await vehicleService.create({ make, model, year, lastMaintenanceDate });
        Log('backend', 'info', 'controller', `Created new vehicle ID: ${data.id}`);
        sendSuccess(res, 201, data, 'Vehicle created successfully');
    } catch (error) {
        sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Error creating vehicle: ${error.message}`);
    }
};

const updateVehicle = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await vehicleService.update(id, req.body);

        if (!data) {
            return sendError(res, 404, 'Vehicle not found', 'backend', 'warn', 'controller', `Cannot update, vehicle ID ${id} not found`);
        }

        Log('backend', 'info', 'controller', `Updated vehicle ID: ${id}`);
        sendSuccess(res, 200, data, 'Vehicle updated successfully');
    } catch (error) {
        sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Error updating vehicle: ${error.message}`);
    }
};

const deleteVehicle = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const success = await vehicleService.delete(id);

        if (!success) {
            return sendError(res, 404, 'Vehicle not found', 'backend', 'warn', 'controller', `Cannot delete, vehicle ID ${id} not found`);
        }

        Log('backend', 'info', 'controller', `Deleted vehicle ID: ${id}`);
        sendSuccess(res, 200, null, 'Vehicle deleted successfully');
    } catch (error) {
        sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Error deleting vehicle: ${error.message}`);
    }
};

const optimize = async (req, res) => {
    try {
        Log('backend', 'info', 'controller', 'Optimization request started');

        const { tasks, maxHours } = req.body;

        // Validation failure
        if (!tasks || !Array.isArray(tasks) || maxHours === undefined || typeof maxHours !== 'number') {
            Log('backend', 'warn', 'controller', 'Optimization validation failed: Invalid tasks array or maxHours');
            return sendError(res, 400, 'tasks array and maxHours number are required', 'backend', 'warn', 'controller', 'Optimization validation failed sent to user');
        }

        const result = optimizeTasks(tasks, maxHours);

        // Successful optimization
        Log('backend', 'info', 'controller', `Optimization successful: Selected ${result.selectedTasks.length} tasks, Total Impact: ${result.totalImpact}`);
        sendSuccess(res, 200, result, 'Optimization completed successfully');
    } catch (error) {
        // Unexpected errors
        sendError(res, 500, 'Internal server error', 'backend', 'error', 'controller', `Optimization unexpected error: ${error.message}`);
    }
};

module.exports = { getAllVehicles, getVehicleById, createVehicle, updateVehicle, deleteVehicle, optimize };
