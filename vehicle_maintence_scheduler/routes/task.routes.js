const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');

// CRUD Routes for Tasks
router.get('/', taskController.getAllTasks);
router.post('/', taskController.createTask);

// Optimization Route
router.post('/optimize', taskController.optimize);

module.exports = router;
