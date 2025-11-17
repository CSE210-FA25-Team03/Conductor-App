const fs = require('fs');
const path = require('path');
const TeamsRepository = require('../TeamsRepository');

/**
 * JsonTeamsRepository - JSON file-based implementation
 * This is what we're currently using and will use until we switch to PostgreSQL
 */
class JsonTeamsRepository extends TeamsRepository {
  constructor() {
    super();
    this.filePath = path.join(__dirname, '../../data/teams.json');
  }

  /**
   * Read teams from JSON file
   * @private
   */
  _readFile() {
    const data = fs.readFileSync(this.filePath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Write teams to JSON file
   * @private
   */
  _writeFile(teams) {
    fs.writeFileSync(this.filePath, JSON.stringify(teams, null, 2), 'utf8');
  }

  /**
   * Get all teams
   */
  async getAllTeams() {
    return this._readFile();
  }

  /**
   * Get a single team by ID
   */
  async getTeamById(id) {
    const teams = this._readFile();
    const team = teams.find(t => t.id === parseInt(id));
    return team || null;
  }

  /**
   * Create a new team
   */
  async createTeam(teamData) {
    const teams = this._readFile();
    
    // Generate new ID
    const maxId = teams.length > 0 ? Math.max(...teams.map(t => t.id)) : 0;
    const newId = maxId + 1;

    // Create new team object
    const newTeam = {
      id: newId,
      teamNumber: teamData.teamNumber || `Team ${newId}`,
      name: teamData.name || '',
      status: teamData.status || 'Needs Review',
      description: teamData.description || '',
      members: teamData.members || [],
      ...(teamData.nextSync && { nextSync: teamData.nextSync }),
      ...(teamData.lastUpdate && { lastUpdate: teamData.lastUpdate }),
      ...(teamData.actionRequired && { actionRequired: teamData.actionRequired })
    };

    teams.push(newTeam);
    this._writeFile(teams);

    return newTeam;
  }

  /**
   * Update an existing team
   */
  async updateTeam(id, teamData) {
    const teams = this._readFile();
    const teamIndex = teams.findIndex(t => t.id === parseInt(id));

    if (teamIndex === -1) {
      return null;
    }

    // Merge existing team with updates
    const updatedTeam = {
      ...teams[teamIndex],
      ...teamData,
      id: parseInt(id) // Ensure ID can't be changed
    };

    teams[teamIndex] = updatedTeam;
    this._writeFile(teams);

    return updatedTeam;
  }

  /**
   * Delete a team
   */
  async deleteTeam(id) {
    const teams = this._readFile();
    const teamIndex = teams.findIndex(t => t.id === parseInt(id));

    if (teamIndex === -1) {
      return false;
    }

    teams.splice(teamIndex, 1);
    this._writeFile(teams);

    return true;
  }
}

module.exports = JsonTeamsRepository;