class EvaluationsRepository {
  async getEvaluationByMemberId(_memberId) {
    throw new Error('getEvaluationByMemberId() must be implemented');
  }
}

module.exports = EvaluationsRepository;
