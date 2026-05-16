const { Log } = require('logging_middleware');

// In-memory storage for assessment purposes
let vehicles = [];
let nextId = 1;

const getAllVehicles = async (req, res) => {
    try {
        Log('backend', 'info', 'controller', 'Fetching all vehicles');
        res.status(200).json(vehicles);
    } catch (error) {
        Log('backend', 'error', 'controller', `Error fetching vehicles: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getVehicleById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const vehicle = vehicles.find(v => v.id === id);

        if (!vehicle) {
            Log('backend', 'warn', 'controller', `Vehicle not found with ID: ${id}`);
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        Log('backend', 'info', 'controller', `Successfully fetched vehicle ID: ${id}`);
        res.status(200).json(vehicle);
    } catch (error) {
        Log('backend', 'error', 'controller', `Error fetching vehicle by ID: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const createVehicle = async (req, res) => {
    try {
        const { make, model, year, lastMaintenanceDate } = req.body;

        // Basic validation
        if (!make || !model || !year) {
            Log('backend', 'warn', 'controller', 'Missing required fields for vehicle creation');
            return res.status(400).json({ message: 'Make, model, and year are required' });
        }

        const newVehicle = {
            id: nextId++,
            make,
            model,
            year,
            lastMaintenanceDate: lastMaintenanceDate || null,
            createdAt: new Date().toISOString()
        };

        vehicles.push(newVehicle);
        Log('backend', 'info', 'controller', `Created new vehicle with ID: ${newVehicle.id}`);
        
        res.status(201).json(newVehicle);
    } catch (error) {
        Log('backend', 'error', 'controller', `Error creating vehicle: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const updateVehicle = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { make, model, year, lastMaintenanceDate } = req.body;

        const vehicleIndex = vehicles.findIndex(v => v.id === id);

        if (vehicleIndex === -1) {
            Log('backend', 'warn', 'controller', `Cannot update. Vehicle not found with ID: ${id}`);
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        vehicles[vehicleIndex] = {
            ...vehicles[vehicleIndex],
            make: make || vehicles[vehicleIndex].make,
            model: model || vehicles[vehicleIndex].model,
            year: year || vehicles[vehicleIndex].year,
            lastMaintenanceDate: lastMaintenanceDate || vehicles[vehicleIndex].lastMaintenanceDate,
            updatedAt: new Date().toISOString()
        };

        Log('backend', 'info', 'controller', `Successfully updated vehicle ID: ${id}`);
        res.status(200).json(vehicles[vehicleIndex]);
    } catch (error) {
        Log('backend', 'error', 'controller', `Error updating vehicle: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteVehicle = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const vehicleIndex = vehicles.findIndex(v => v.id === id);

        if (vehicleIndex === -1) {
            Log('backend', 'warn', 'controller', `Cannot delete. Vehicle not found with ID: ${id}`);
            return res.status(404).json({ message: 'Vehicle not found' });
        }

        vehicles.splice(vehicleIndex, 1);
        Log('backend', 'info', 'controller', `Successfully deleted vehicle ID: ${id}`);
        
        res.status(200).json({ message: 'Vehicle deleted successfully' });
    } catch (error) {
        Log('backend', 'error', 'controller', `Error deleting vehicle: ${error.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getAllVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    deleteVehicle
};
