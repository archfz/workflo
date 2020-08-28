const conf = require('../init');
const config = require('../config');
const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');
const Confirm = require('prompt-confirm');
const dateFormat = require('dateformat');
const axios = require('axios');
const JiraHandler = require('./source_jira_handlers/handler');

const TASK_MAP = Object.entries(JSON.parse(config.jira_clone_task_to_task_map));
const JOB_TASK_MAP = Object.entries(JSON.parse(config.jira_clone_job_to_task_map));

function matchJob(job) {
  for (let [regex, task] of JOB_TASK_MAP) {
    if (regex === job || job.match(new RegExp(regex))) {
      return task;
    }
  }
}

function matchTask(id) {
  for (let [regex, task] of TASK_MAP) {
    if (id === regex || id.match(new RegExp(regex))) {
      return task;
    }
  }
}

function getTargetTask(job, id) {
  if (config.jira_clone_mapping_priority === 'job_to_task') {
    return matchJob(job) || matchTask(id) || config.jira_clone_target_default_job;
  } else {
    return matchTask(id) || matchJob(job) || config.jira_clone_target_default_job;
  }
}

function getMonday() {
  let d = new Date();
  let day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
  let date = new Date(d.setDate(diff));
  date.setHours(0);
  return date;
}

function getFriday() {
  let d = new Date();
  let day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -3:5); // adjust when day is sunday
  return  new Date(d.setDate(diff));
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
  endDate.setHours(23);

  const jiraFromUrl = config.source_jira_url + '/' +
    (new JiraHandler()).getPathCloneLogsFrom(dateFormat(startDate, 'yyyy-mm-dd'), dateFormat(endDate, 'yyyy-mm-dd'));
  let logMap = {};

  await getBrowser(jiraFromUrl, async (driver, close) => {
    await new JiraHandler(driver).acquireLogs(getTargetTask, startDate, endDate)
      .then((result) => logMap = result);
  });

  console.log(JSON.stringify(logMap, null, 2));

  const prompt = new Confirm('Are the logs ok?');
  await prompt.run()
    .then(async (answer) => {
      if (!answer) {
        process.exit(0);
      }
    });

  const jiraTargetUrl = process.env.JIRA_CLONE_TARGET_URL + "/secure/TempoUserBoard!timesheet.jspa?classicView=true";
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

            await driver.sleep(200);
            const taskElement = await driver.findElement(By.css(process.env.JIRA_CLONE_ISSUE_INPUT_SELECTOR));
            await taskElement.sendKeys(taskId + "\n");

            return driver.findElement(By.css(process.env.JIRA_CLONE_LOG_WORK_SUBMIT_BUTTON_SELECTOR))
              .then((element) => element.click())
              .then(() => driver.sleep(800));
          });
      });
    });

    await promise;
    await driver.sleep(500);
  });

  if (endDate.getDay() === 5) {
    const jiraTargetSubmitUrl = process.env.JIRA_CLONE_TARGET_URL + "/secure/TempoUserBoard!timesheet.jspa?classicView=true&periodType=BILLING&periodView=WEEK&period="
      + dateFormat(startDate, 'ddmmyyyy');
    await getBrowser(jiraTargetSubmitUrl, async (driver, close) => {
      await driver.wait(until.elementLocated(By.css('.tempoaction-open-dialog-form')), 10000);

      const openDialogButton = await driver.findElement(By.css('.tempoaction-open-dialog-form'));
      await openDialogButton.click();

      await driver.wait(until.elementLocated(By.css(process.env.JIRA_CLONE_APPROVAL_REVIEWER_SELECTOR)), 10000);
      await driver.executeScript(`document.querySelector("${process.env.JIRA_CLONE_APPROVAL_REVIEWER_SELECTOR}").value=arguments[0]`, config.jira_clone_approver_id);

      const joke = await axios.post("https://icanhazdadjoke.com/graphql", "{\"query\": \"query { joke {joke } }\"}", {
        headers: {"Content-Type": "application/json"}
      }).then((response) => response.data.data.joke.joke)
        .catch((error) => {
          console.error(error);
          return "Failed to fetch joke this time! :("
        });

      await driver.executeScript(`document.querySelector("${process.env.JIRA_CLONE_APPROVAL_COMMENT_SELECTOR}").value=arguments[0]`, joke);
      await driver.findElement(By.css(process.env.JIRA_CLONE_APPROVAL_SUBMIT_BTN_SELECTOR))
        .then((element) => element.click());

      await driver.sleep(2000);
    });
  }
})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
