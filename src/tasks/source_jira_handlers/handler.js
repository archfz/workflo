const config = require('../../config');
const sourceJiraHandlers = {
  'inchcape': require('./inchcape'),
  'summit': require('./summit'),
};
module.exports = sourceJiraHandlers[config.source_jira_handler];
