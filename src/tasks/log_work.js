const conf = require('../init');
const {By, until} = require('selenium-webdriver');
const config = require('../config');
const getBrowser = require('../get_browser');
const JiraHandler = require('./source_jira_handlers/handler');

(async function () {
  const taskId = process.argv[2];
  const description = process.argv[3];
  const logTime = Number.parseFloat(process.argv[4]);

  if (isNaN(logTime) || logTime === 0) {
    throw new Error(`Invalid log time: ${process.argv[4]}`);
  }

  const url = config.source_jira_url + "/browse/" + taskId;

  await getBrowser(url, async (driver) => {
    const handler = new JiraHandler(driver);
    await handler.logWork(logTime, description);
  });
})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
