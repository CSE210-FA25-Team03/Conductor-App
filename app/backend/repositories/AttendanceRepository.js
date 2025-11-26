class AttendanceRepository {
  async getAllAttendance(_filters = {}) {
    throw new Error('getAllAttendance() must be implemented');
  }

  async getAttendanceById(_id) {
    throw new Error('getAttendanceById() must be implemented');
  }

  async createAttendance(_attendance) {
    throw new Error('createAttendance() must be implemented');
  }

  async updateAttendance(_id, _attendance) {
    throw new Error('updateAttendance() must be implemented');
  }

  async deleteAttendance(_id) {
    throw new Error('deleteAttendance() must be implemented');
  }

  async getAttendanceStats(_filters = {}) {
    throw new Error('getAttendanceStats() must be implemented');
  }
}

module.exports = AttendanceRepository;

