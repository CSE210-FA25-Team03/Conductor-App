const fs = require('fs');
const path = require('path');
const EvaluationsRepository = require('../EvaluationsRepository');

const EVALUATIONS_FILE_PATH = path.join(__dirname, '../../data/evaluations.json');

class JsonEvaluationsRepository extends EvaluationsRepository {
  constructor() {
    super();
    this.filePath = EVALUATIONS_FILE_PATH;
  }

  _readFile() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    const data = fs.readFileSync(this.filePath, 'utf8');
    return JSON.parse(data);
  }

  async getEvaluationByMemberId(memberId) {
    const evaluations = this._readFile();
    const evaluation = evaluations.find((entry) => entry.memberId === parseInt(memberId, 10));
    return evaluation || null;
  }
}

module.exports = JsonEvaluationsRepository;
