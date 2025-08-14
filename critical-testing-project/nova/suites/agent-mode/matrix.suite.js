/**
 * Agent Mode - Parameter Matrix Suite
 * Re-exports matrix tests defined alongside decide tests.
 */

const decideSuite = require('./decide.suite');

module.exports = {
  name: 'Agent Mode - Matrix',
  tests: decideSuite.tests.filter(t => t.id && t.id.startsWith('agent.matrix.'))
};

