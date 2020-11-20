const conf = require('../init');
const config = require('../config');
const getBrowser = require('../get_browser');
const browserUtils = require('../browser_utils');
const JiraHandler = require('./source_jira_handlers/handler');

(async function () {
  const taskId = process.argv[2];
  const url = config.source_jira_url + "/browse/" + taskId;

  await getBrowser(url, async (driver) => {
    const handler = new JiraHandler(driver);

    const promises = [];
    promises.push(handler.acquireTaskTitle()
      .then((taskTitle) => {
        console.log('Actual title: ', taskTitle);

        let taskTitleParts = taskTitle
          .replace(/-*/g, '')
          .toLowerCase()
          .replace(/\([^)]+\)/g, '')
          .replace(/[^a-z]bug[^a-z]|[^a-z]task[^a-z]|[^a-z]the[^a-z]|[^a-z]a[^a-z]|[^a-z]an[^a-z]/g, ' ')
          .replace(/[^a-zA-Z\s]+/g, ' ')
          .replace(/\s+$/, '')
          .replace(/^\s+/, '')
          .split(/[\s]+/);

        if (taskTitleParts.length > 6) {
          taskTitleParts = taskTitleParts.slice(0, 3).concat(taskTitleParts.slice(-3));
        }

        console.log(">TASK-TITLE: " +taskTitleParts.join('_'));
      }));

    promises.push(handler.acquireTaskType()
      .then((type) => {
        console.log(">TASK-TYPE: " + type.toLowerCase()
          .replace(/[^a-zA-Z]+/g, '_'));
      }));

    promises.push(
      handler.setTaskStatusInProgress().then((status) => {
        console.log(`>STATUS: ${status}`);
      })
      .catch((e) => {
        console.error(e.message ? e.message : e);
        console.error('Failed setting task in progress.');
      })
      .then(() => handler.assignSelfToTask()).catch((e) => {
        console.error('Failed to assign task to self. Assuming it is already assigned.');
        console.error(e.message ? e.message : e);
      })
    );

    await Promise.all(promises);

    const parentLink = await handler.acquireParentTaskLink();
    if (parentLink) {
      await browserUtils.navigateToLink(driver, parentLink);
      await handler.setTaskStatusInProgress().catch((e) => {
        console.error(e);
        console.error('Failed setting parent in progress.');
      });
    }
  });
})().catch(e => {
  !e.isLogged && console.error(e);
  process.exit(1);
});
