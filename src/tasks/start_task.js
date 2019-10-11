const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');
const browserUtils = require('../browser_utils');

async function setTaskStatusInProgress(driver) {
  return driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID))
    .then(async element => {
      const status = await element.getText();

      if (status.toLowerCase() !== process.env.TASK_IN_PROGRESS_LABEL.toLowerCase()) {
          const startProgressBtn = await driver.findElement(By.id(process.env.START_PROGRESS_BUTTON_ACTION_ID));
          await startProgressBtn.click();

          try {
            await driver.sleep(100);
            const element = await driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID));
            await driver.wait(until.elementTextIs(element, process.env.TASK_IN_PROGRESS_LABEL), 4000);
          } catch (e) {
            console.warn(e);
          }
      }

      return status;
    });
}

(async function () {
  const taskId = process.argv[2];
  const url = process.env.JIRA_BASE_URL + "/browse/" + taskId;

  await getBrowser(url, async (driver) => {
    await driver.wait(until.elementLocated(By.id(process.env.TASK_TITLE_ELEMENT_ID)), 10000);

    const promises = [];
    promises.push(driver.findElement(By.id(process.env.TASK_TITLE_ELEMENT_ID))
      .then((element) => element.getText())
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

    promises.push(
      setTaskStatusInProgress(driver).then((status) => {
        console.log(`>STATUS: ${status}`);
      })
      .catch((e) => {
        console.error(e);
        console.error('Failed setting parent in progress.');
      })
      .then(async () => {
        let assignTask;

        try {
          assignTask = await driver.findElement(By.id(process.env.ASSIGN_SELF_TO_TASK_BUTTON_ID));
        } catch (e) {
          console.error(e);
          return;
        }

        return assignTask.click();
      })
    );

    promises.push(driver.findElement(By.id(process.env.TASK_TYPE_ELEMENT_ID))
      .then((element) => element.getText())
      .then((type) => {
        console.log(">TASK-TYPE: " + type.toLowerCase()
          .replace(/[^a-zA-Z]+/g, '_'));
      }));

    await Promise.all(promises);

    const parents = await driver.findElements(By.id(process.env.LINK_PARENT_ISSUE_ID));
    if (parents.length > 0) {
      const link = driver.findElement(By.id(process.env.LINK_PARENT_ISSUE_ID));
      await browserUtils.navigateToLink(driver, link);
      await setTaskStatusInProgress(driver).catch((e) => {
        console.error(e);
        console.error('Failed setting parent in progress.');
      });
    }
  });
})().catch(e => {
  !e.isLogged && console.error(e);
  process.exit(1);
});
