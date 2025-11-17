/**
 * TeamsRepository - Abstract interface for team data access
 * This defines the contract that all implementations must follow
 */
class TeamsRepository {
    /**
     * Get all teams
     * @returns {Promise<Array>} Array of team objects
     */
    async getAllTeams() {
      throw new Error('getAllTeams() must be implemented');
    }
  
    /**
     * Get a single team by ID
     * @param {number} id - Team ID
     * @returns {Promise<Object|null>} Team object or null if not found
     */
    async getTeamById(id) {
      throw new Error('getTeamById() must be implemented');
    }
  
    /**
     * Create a new team
     * @param {Object} teamData - Team data object
     * @returns {Promise<Object>} Created team object with ID
     */
    async createTeam(teamData) {
      throw new Error('createTeam() must be implemented');
    }
  
    /**
     * Update an existing team
     * @param {number} id - Team ID
     * @param {Object} teamData - Updated team data
     * @returns {Promise<Object|null>} Updated team object or null if not found
     */
    async updateTeam(id, teamData) {
      throw new Error('updateTeam() must be implemented');
    }
  
    /**
     * Delete a team
     * @param {number} id - Team ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async deleteTeam(id) {
      throw new Error('deleteTeam() must be implemented');
    }
  }
  
  module.exports = TeamsRepository;