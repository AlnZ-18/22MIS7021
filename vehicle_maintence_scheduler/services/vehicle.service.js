// In-memory array for assessment purposes
let vehicles = [];
let nextId = 1;

class VehicleService {
    async getAll() {
        return vehicles;
    }

    async getById(id) {
        return vehicles.find(v => v.id === id);
    }

    async create(data) {
        const newVehicle = {
            id: nextId++,
            ...data,
            createdAt: new Date().toISOString()
        };
        vehicles.push(newVehicle);
        return newVehicle;
    }

    async update(id, data) {
        const index = vehicles.findIndex(v => v.id === id);
        if (index === -1) return null;

        vehicles[index] = {
            ...vehicles[index],
            ...data, // overwrite only provided fields
            updatedAt: new Date().toISOString()
        };
        return vehicles[index];
    }

    async delete(id) {
        const index = vehicles.findIndex(v => v.id === id);
        if (index === -1) return false;

        vehicles.splice(index, 1);
        return true;
    }
}

module.exports = new VehicleService();
