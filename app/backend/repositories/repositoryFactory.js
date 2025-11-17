const JsonTeamsRepository = require('./implementations/JsonTeamsRepository');
// const PostgresTeamsRepository = require('./implementations/PostgresTeamsRepository');

/**
 * Repository Factory
 * Central place to create and configure repositories
 * Switch between implementations here by changing the storage type
 */
class RepositoryFactory {
  constructor() {
    // This is where you'll switch implementations later
    // For now, use JSON. Later: const storageType = process.env.STORAGE_TYPE || 'json';
    this.storageType = 'json';
  }

  createTeamsRepository() {
    switch (this.storageType) {
      case 'json':
        return new JsonTeamsRepository();
      
      // case 'postgres':
      //   return new PostgresTeamsRepository();
      
      default:
        throw new Error(`Unknown storage type: ${this.storageType}`);
    }
  }
}

// Export a singleton instance
module.exports = new RepositoryFactory();