const express = require('express');
const cors = require('cors');
const { Log } = require('logging_middleware');
const vehicleRoutes = require('./routes/vehicle.routes');
const taskRoutes = require('./routes/task.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Added to ensure urlencoded bodies are parsed

// Global Request Logging Middleware
app.use((req, res, next) => {
    Log('backend', 'info', 'route', `Incoming request: ${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/tasks', taskRoutes);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    Log('backend', 'error', 'middleware', `Unhandled error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    Log('backend', 'info', 'service', `Server started on port ${PORT}`);
});
