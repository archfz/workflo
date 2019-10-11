const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');
const Confirm = require('prompt-confirm');

const JOB_TASK_MAP = Object.entries(JSON.parse(process.env.JIRA_CLONE_JOB_TO_TASK_MAP));

function getTargetTaskFromJob(job) {
  for (let [regex, task] of JOB_TASK_MAP) {
    if (job.match(new RegExp(regex))) {
      return task;
    }
  }

  return process.env.JIRA_CLONE_DEFAULT_JOB;
}

function escapeQ(str) {
  return (str + "").replace("\\n", "\\\\n").replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")
}

(async function () {
  const beforeDateString = process.argv[2];
  const jiraFromUrl = process.env.JIRA_BASE_URL + "/secure/TempoUserBoard!worklogs.jspa";
  const logMap = {};
  let beforeDate;

  if (beforeDateString) {
    beforeDate = new Date(beforeDateString);
    console.log("Logging only before: " + beforeDate);
  }

  await getBrowser(jiraFromUrl, async (driver, close) => {
    await driver.wait(until.elementLocated(By.css(process.env.JIRA_CLONE_TASK_ROW_SELECTOR)), 10000);
    await driver.sleep(1000);

    try {
      await driver.findElement(By.id(process.env.LOGS_INTERVAL_WEEK_BUTTON_SELECTOR)).then((button) => button.click());
      await driver.findElement(By.css(process.env.LOGS_INTERVAL_WEEK_BUTTON_SELECTOR)).then((button) => button.click());
      await driver.sleep(1000);
    } catch (e) {
      console.error(e);
    }

    const elements = await driver.findElements(By.css(process.env.JIRA_CLONE_TASK_ROW_SELECTOR));

    await Promise.all(elements.map((element) => {
      let promises = [
        element.findElement(By.css(process.env.JIRA_CLONE_TASK_LOG_TIME_SELECTOR)).then(element => element.getText()),
        element.findElement(By.css(process.env.JIRA_CLONE_TASK_DAY_SELECTOR)).then(element => element.getText()),
        element.findElement(By.css(process.env.JIRA_CLONE_TASK_ID_SELECTOR)).then(element => element.getText()),
        element.findElement(By.css(process.env.JIRA_CLONE_TASK_DESCRIPTION_SELECTOR)).then(element => element.getText()),
        element.findElement(By.css(process.env.JIRA_CLONE_TASK_LOG_JOB_SELECTOR)).then(element => element.getText()),
      ];

      return Promise.all(promises)
        .then(([time, day, id, description, job]) => {
          if (!id) {
            return;
          }

          if (beforeDate) {
            const parsedDate = new Date(day);
            console.log("Checking log for day: " + parsedDate);
            if (parsedDate >= beforeDate) {
              console.log("Skipping log for day: " + parsedDate);
              return;
            }
          }

          const target = getTargetTaskFromJob(job);

          if (!logMap[day]) {
            logMap[day] = {};
          }
          if (!logMap[day][target]) {
            logMap[day][target] = { time: 0, description: "" };
          }

          const timeFloat = parseFloat(time);
          if (isNaN(timeFloat)) {
            throw new Error(`Failed to calculate time log from '${time}'.`);
          }

          logMap[day][target].time += timeFloat;
          logMap[day][target].description += id + ": " + description + "\n";
        });
    }));

    console.log(JSON.stringify(logMap, null, 2));

    const prompt = new Confirm('Are the logs ok?');
    await prompt.run()
      .then(async (answer) => {
        if (!answer) {
          await close();
          process.exit(0);
        }
      });
  });

  const jiraTargetUrl = process.env.JIRA_CLONE_TARGET_URL + "/secure/TempoUserBoard!timesheet.jspa";
  await getBrowser(jiraTargetUrl, async (driver, close) => {
    await driver.wait(until.elementLocated(By.css(process.env.JIRA_CLONE_LOG_WORK_BUTTON_SELECTOR)), 10000);

    let promise = Promise.resolve();

    Object.entries(logMap).forEach(([date, tasks]) => {
      Object.entries(tasks).forEach(async ([taskId, data]) => {
        promise = promise
          .then(() => driver.findElement(By.css(process.env.JIRA_CLONE_LOG_WORK_BUTTON_SELECTOR)))
          .then((element) => element.click())
          .then(() => driver.wait(until.elementLocated(By.css(process.env.JIRA_CLONE_ISSUE_INPUT_SELECTOR)), 10000))
          .then(async () => {
            console.log("Logging " + taskId + " " + data.time.toString() + "h" + " " + data.description);

            driver.executeScript(`document.querySelector("${process.env.JIRA_CLONE_DATE_INPUT_SELECTOR}").value=arguments[0]`, date);
            driver.executeScript(`document.querySelector("${process.env.JIRA_CLONE_TIME_INPUT_SELECTOR}").value=arguments[0]`, data.time);
            driver.executeScript(`document.querySelector("${process.env.JIRA_CLONE_DESC_INPUT_SELECTOR}").value=arguments[0]`, data.description);

            await driver.sleep(100);
            const taskElement = await driver.findElement(By.css(process.env.JIRA_CLONE_ISSUE_INPUT_SELECTOR));
            await taskElement.sendKeys(taskId + "\n");

            return Promise.resolve()
              .then(() => driver.findElement(By.css(process.env.JIRA_CLONE_LOG_WORK_SUBMIT_BUTTON_SELECTOR)))
              .then((element) => element.click())
              .then(() => driver.sleep(1000));
          });
      });
    });

    await promise;
  });
})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
