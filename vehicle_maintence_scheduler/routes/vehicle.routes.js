const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');

// Optimization Route
router.post('/optimize', vehicleController.optimize);

// CRUD Routes for Vehicles
router.get('/', vehicleController.getAllVehicles);
router.post('/', vehicleController.createVehicle);
router.get('/:id', vehicleController.getVehicleById);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);

module.exports = router;
