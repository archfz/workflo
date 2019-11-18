const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');
const Confirm = require('prompt-confirm');
const dateFormat = require('dateformat');

const JOB_TASK_MAP = Object.entries(JSON.parse(process.env.JIRA_CLONE_JOB_TO_TASK_MAP));

function getTargetTaskFromJob(job) {
  for (let [regex, task] of JOB_TASK_MAP) {
    if (job.match(new RegExp(regex))) {
      return task;
    }
  }

  return process.env.JIRA_CLONE_DEFAULT_JOB;
}

function getMonday() {
  let d = new Date();
  let day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

function getFriday() {
  let d = new Date();
  let day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -3:5); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

function escapeQ(str) {
  return (str + "").replace("\\n", "\\\\n").replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")
}

(async function () {
  const startDateStr = process.argv[2];
  const endDateStr = process.argv[3];
  let startDate, endDate;

  if (!startDateStr) {
    startDate = getMonday();
  } else {
    startDate = new Date(startDateStr);
  }

  if (!endDateStr) {
    endDate = getFriday();
  } else {
    endDate = new Date(endDateStr);
  }

  const jiraFromUrl = (process.env.JIRA_BASE_URL + process.env.JIRA_CLONE_SOURCE_PATH)
    .replace('{from}', dateFormat(startDate, 'yyyy-mm-dd'))
    .replace('{to}', dateFormat(endDate, 'yyyy-mm-dd'));
  const logMap = {};

  await getBrowser(jiraFromUrl, async (driver, close) => {
    await driver.wait(until.elementLocated(By.css(process.env.JIRA_CLONE_OPEN_DATE_BUTTON_SELECTOR)), 10000);

    await driver.findElement(By.css(process.env.JIRA_CLONE_OPEN_DATE_BUTTON_SELECTOR))
      .then((element) => element.click());
    await driver.sleep(1500);
    await driver.findElement(By.css(process.env.JIRA_CLONE_DATE_FROM_SELECTOR))
      .then(element => element.sendKeys('\b'.repeat(20) + dateFormat(startDate, 'dd/mmm/yyyy')));
    await driver.findElement(By.css(process.env.JIRA_CLONE_DATE_TO_SELECTOR))
      .then(element => element.sendKeys('\b'.repeat(20) + dateFormat(endDate, 'dd/mmm/yyyy')));
    await driver.findElement(By.xpath(process.env.JIRA_CLONE_APPLY_DATE_BUTTON_XPATH))
      .then(element => element.click());

    await driver.sleep(1500);
    await driver.wait(until.elementLocated(By.css(process.env.JIRA_CLONE_TASK_ROW_SELECTOR)), 10000);

    const elements = await driver.findElements(By.css(process.env.JIRA_CLONE_TASK_ROW_SELECTOR));
    console.log(`Found ${elements.length} logs.`);
    let promise = Promise.resolve();

    elements.forEach((element, index) => {
      promise = promise.then(async () => {
        await element.findElement(By.css(process.env.JIRA_CLONE_TASK_LOG_JOB_SELECTOR))
          .catch(e => console.warn(`Skipping row ${index}`));

        await driver.executeScript("arguments[0].scrollIntoView(true)", element);
        await driver.sleep(100);

        let promises = [
          element.findElement(By.css(process.env.JIRA_CLONE_TASK_LOG_TIME_SELECTOR)).then(element => element.getText()),
          element.findElement(By.css(process.env.JIRA_CLONE_TASK_DAY_SELECTOR)).then(element => element.getText()),
          element.findElement(By.css(process.env.JIRA_CLONE_TASK_ID_SELECTOR)).then(element => element.getText()),
          element.findElement(By.css(process.env.JIRA_CLONE_TASK_DESCRIPTION_SELECTOR)).then(element => element.getText()),
          element.findElement(By.css(process.env.JIRA_CLONE_TASK_LOG_JOB_SELECTOR)).then(element => element.getAttribute('value')),
        ];

        await Promise.all(promises)
          .then(([time, day, id, description, job]) => {
            if (!id) {
              console.warn(`WARNING: Skipping log on index ${index}. ID not found. Other data: ${time} ${day} ${job} ${description}`);
              return;
            }

            const dayDate = new Date(day + " 12:00:00");
            if (dayDate < startDate || dayDate > endDate) {
              console.warn(`WARNING: Skipping ${index}. Date '${day}' not in range.`);
              return;
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
      });
    });

    await promise;

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
              .then(() => driver.sleep(1200));
          });
      });
    });

    await promise;
  });
})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
