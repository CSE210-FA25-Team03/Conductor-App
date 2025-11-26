const fs = require('fs');
const path = require('path');
const AttendanceRepository = require('../AttendanceRepository');

const ATTENDANCE_FILE_PATH = path.join(__dirname, '../../data/attendance.json');

class JsonAttendanceRepository extends AttendanceRepository {
  constructor() {
    super();
    this.filePath = ATTENDANCE_FILE_PATH;
    this._ensureFileExists();
  }

  _ensureFileExists() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
    }
  }

  _readFile() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      // If file is empty or only whitespace, return empty array
      if (!data || !data.trim()) {
        return [];
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading attendance.json:', error.message);
      console.error('File path:', this.filePath);
      // Return empty array on parse error to prevent complete failure
      // The file will be recreated on next write
      return [];
    }
  }

  _writeFile(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async getAllAttendance(filters = {}) {
    let records = this._readFile();

    // Apply filters
    if (filters.type) {
      records = records.filter(r => r.type === filters.type);
    }
    if (filters.dateFrom) {
      records = records.filter(r => r.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      records = records.filter(r => r.date <= filters.dateTo);
    }
    if (filters.teamId) {
      records = records.filter(r => 
        r.attendees.some(a => a.teamId === parseInt(filters.teamId, 10))
      );
    }

    return records;
  }

  async getAttendanceById(id) {
    const records = this._readFile();
    return records.find(r => r.id === id) || null;
  }

  async createAttendance(attendance) {
    const records = this._readFile();
    const newRecord = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...attendance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.push(newRecord);
    this._writeFile(records);
    return newRecord;
  }

  async updateAttendance(id, updates) {
    const records = this._readFile();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
      return null;
    }
    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this._writeFile(records);
    return records[index];
  }

  async deleteAttendance(id) {
    const records = this._readFile();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
      return false;
    }
    records.splice(index, 1);
    this._writeFile(records);
    return true;
  }

  async getAttendanceStats(filters = {}) {
    const records = await this.getAllAttendance(filters);
    
    // Group by team and calculate percentages
    const teamStats = {};
    const classStats = { total: 0, present: 0 };

    records.forEach(record => {
      record.attendees.forEach(attendee => {
        const teamId = attendee.teamId;
        
        // If teamId filter is set, only process attendees from that team
        if (filters.teamId !== undefined && filters.teamId !== null) {
          if (attendee.teamId !== filters.teamId) {
            return;
          }
        }
        
        // Skip if teamId is null/undefined (unless we're filtering for null)
        if (teamId === null || teamId === undefined) {
          if (filters.teamId !== null && filters.teamId !== undefined) {
            return;
          }
        }
        
        if (!teamStats[teamId]) {
          teamStats[teamId] = { teamId, teamName: attendee.teamName || `Team ${teamId}`, total: 0, present: 0 };
        }
        teamStats[teamId].total++;
        classStats.total++;
        if (attendee.status === 'present') {
          teamStats[teamId].present++;
          classStats.present++;
        }
      });
    });

    // Calculate percentages
    const teamComparison = Object.values(teamStats).map(team => ({
      teamId: team.teamId,
      teamName: team.teamName,
      percentage: team.total > 0 ? Math.round((team.present / team.total) * 100) : 0,
      present: team.present,
      total: team.total
    }));

    const classAverage = classStats.total > 0 
      ? Math.round((classStats.present / classStats.total) * 100) 
      : 0;

    return {
      teamComparison,
      classAverage,
      totalRecords: records.length
    };
  }
}

module.exports = JsonAttendanceRepository;

