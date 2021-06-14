const {By, until} = require('selenium-webdriver');
const dateFormat = require('dateformat');

module.exports = class SummitJira {
  constructor(driver) {
    this.driver = driver;
  }

  async acquireTaskTitle() {
    await this.driver.wait(until.elementLocated(By.id(process.env.TASK_TITLE_ELEMENT_ID)), 10000);

    return this.driver.findElement(By.id(process.env.TASK_TITLE_ELEMENT_ID))
      .then((element) => element.getText());
  }

  async acquireTaskType() {
    return this.driver.findElement(By.id(process.env.TASK_TYPE_ELEMENT_ID))
      .then((element) => element.getText());
  }

  async acquireParentTaskLink() {
    const parents = await this.driver.findElements(By.id(process.env.LINK_PARENT_ISSUE_ID));
    if (parents.length > 0) {
      return this.driver.findElement(By.id(process.env.LINK_PARENT_ISSUE_ID));
    }
    return null;
  }

  async assignSelfToTask() {
    let assignTask = await this.driver.findElement(By.id(process.env.ASSIGN_SELF_TO_TASK_BUTTON_ID));
    return assignTask.click();
  }

  async setTaskStatusInProgress() {
    return this.driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID))
      .then(async element => {
        const status = await element.getText();

        if (status.toLowerCase() !== process.env.TASK_IN_PROGRESS_LABEL.toLowerCase()) {
          const moreActions = await this.driver.findElement(By.css('#opsbar-transitions_more'));
          await moreActions.click();
          const startProgressBtn = await this.driver.findElement(By.id(process.env.START_PROGRESS_BUTTON_ACTION_ID));
          await startProgressBtn.click();

          try {
            await this.driver.sleep(100);
            const element = await this.driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID));
            await this.driver.wait(until.elementTextIs(element, process.env.TASK_IN_PROGRESS_LABEL), 4000);
          } catch (e) {
            console.warn(e);
          }
        }

        return status;
      });
  }

  async setTaskStatusInCodeReview() {
    return this.driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID))
      .then(async element => {
        const status = await element.getText();

        if (status.toLowerCase() !== process.env.TASK_IN_CODE_REVIEW_LABEL.toLowerCase()) {
          const moreOptions = await this.driver.findElement(By.css('#opsbar-transitions_more'));
          await moreOptions.click();
          const setInCodeReviewButton = await this.driver.findElement(By.id(process.env.SET_IN_CODEREVIEW_BUTTON_ACTION_ID));
          await setInCodeReviewButton.click();

          try {
            await this.driver.sleep(100);
            const element = await this.driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID));
            await this.driver.wait(until.elementTextIs(element, process.env.TASK_IN_CODE_REVIEW_LABEL), 4000);
          } catch (e) {
            console.warn(e);
          }
        }

        return status;
      });
  }

  async logWork(logTime, description) {
    await this.driver.wait(until.elementLocated(By.id(process.env.TASK_TITLE_ELEMENT_ID)), 10000);

    const moreOptionsButton = await this.driver.findElement(By.id(process.env.TASK_MORE_OPTIONS_BUTTON));
    await moreOptionsButton.click();
    const logWorkButton = await this.driver.findElement(By.id(process.env.LOG_WORK_SCREEN_BUTTON_ID));
    await logWorkButton.click();

    await this.driver.wait(until.elementLocated(By.css(process.env.INPUT_LOG_WORK_TIME_SELECTOR)), 5000);

    const form = await this.driver.findElement(By.css(process.env.FORM_WORKLOG_SELECTOR));
    await form.findElement(By.css(process.env.INPUT_LOG_WORK_TIME_SELECTOR)).then(async (element) => {
      await this.driver.sleep(1500);
      return element.sendKeys(`${logTime}h`);
    });
    await form.findElement(By.css(process.env.INPUT_LOG_WORK_DESCRIPTION_SELECTOR)).then((element) => {
      return element.sendKeys(`${description}`);
    });

    const logWorkSubmit = await this.driver.findElement(By.css("button[name='submitWorklogButton']"));
    await logWorkSubmit.click();
    await this.driver.sleep(500);
    await this.driver.findElements(By.css(process.env.LOG_WORK_ERROR_CONTAINER_SELCTOR + " *"))
      .then((elements) => {
        if (elements.length > 0) {
          return this.driver.sleep(10000)
            .then(() => {
              throw new Error(`Failed logging work. Errors encountered.`);
            });
        }
      });
    await this.driver.wait(until.elementIsNotVisible(form), 1500);
  }

  getPathCloneLogsFrom(startDate, endDate) {
    return '/secure/Tempo.jspa#/my-work/timesheet?columns=WORKED_COLUMN&columns=_Job_&columns=ACCOUNT_COLUMN&dateDisplayType=days&from={from}&groupBy=worklog&periodKey&periodType=FIXED&subPeriodType=MONTH&to={to}&viewType=LIST'
      .replace('{from}', startDate)
      .replace('{to}', endDate);
  }

  async acquireLogs(getTargetTask, startDate, endDate) {
    const logMap = {};

    await this.driver.wait(until.elementLocated(By.css(process.env.JIRA_CLONE_TASK_ROW_SELECTOR)), 10000);

    await this.driver.executeScript("document.body.style.zoom='90%';");
    const elements = await this.driver.findElements(By.css(process.env.JIRA_CLONE_TASK_ROW_SELECTOR));
    console.log(`Found ${elements.length} logs.`);
    let promise = Promise.resolve();

    elements.forEach((element, index) => {
      promise = promise.then(async () => {
        await element.findElement(By.css(process.env.JIRA_CLONE_TASK_LOG_JOB_SELECTOR))
          .catch(e => console.warn(`Skipping row ${index}`));

        await this.driver.executeScript("arguments[0].scrollIntoView(true)", element);
        await this.driver.sleep(100);

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

            const dayDate = new Date(day);
            dayDate.setHours(6);
            if (dayDate < startDate || dayDate > endDate) {
              console.warn(`WARNING: Skipping ${index}. Date '${day}' not in range.`);
              return;
            }

            const target = getTargetTask(job, id);

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
    return logMap;
  }
};
