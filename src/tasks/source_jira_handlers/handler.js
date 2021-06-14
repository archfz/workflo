const config = require('../../config');
const sourceJiraHandlers = {
  'inchcape': require('./inchcape'),
  'inchcape-new-ui': require('./inchcape-new-ui'),
  'summit': require('./summit'),
};
module.exports = sourceJiraHandlers[config.source_jira_handler];
