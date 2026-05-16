const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');

// CRUD Routes for Vehicles
router.get('/', vehicleController.getAllVehicles);
router.post('/', vehicleController.createVehicle);
router.get('/:id', vehicleController.getVehicleById);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);

module.exports = router;
