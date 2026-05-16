let tasks = [];
let nextId = 1;

class TaskService {
    async getAll() {
        return tasks;
    }

    async create(data) {
        const newTask = {
            id: `T${nextId++}`,
            name: data.name,
            duration: data.duration,
            impact: data.impact,
            createdAt: new Date().toISOString()
        };
        tasks.push(newTask);
        return newTask;
    }
}

module.exports = new TaskService();
