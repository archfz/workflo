const {By, until} = require('selenium-webdriver');

const TASK_PROGRESS_ELEMENT_ID = 'status-val';

module.exports = class InchcapeJira {
  constructor(driver) {
    this.driver = driver;
  }

  async acquireTaskTitle() {
    await this.driver.wait(until.elementLocated(By.css('#summary-val')), 10000);

    return this.driver.findElement(By.css('#summary-val'))
      .then((element) => element.getText());
  }

  async acquireTaskType() {
    return this.driver.findElement(By.id('type-val'))
      .then((element) => element.getText());
  }

  async acquireParentTaskLink() {
    const parents = await this.driver.findElements(By.id('parent_issue_summary'));
    if (parents.length > 0) {
      return this.driver.findElement(By.id('parent_issue_summary'));
    }
    return null;
  }

  async assignSelfToTask() {
    let assignTask = await this.driver.findElements(By.id('assign-to-me'));
    if (assignTask.length) {
      await this.driver.findElement(By.id('assign-to-me')).click();
    }
  }

  async setTaskStatusInProgress() {
    return this.driver.findElement(By.id(TASK_PROGRESS_ELEMENT_ID))
      .then(async element => {
        const status = await element.getText();

        if (status.toLowerCase() !== 'in progress') {
          const startProgressBtn = await this.driver.findElement(By.id('action_id_21'));
          await startProgressBtn.click();

          try {
            await this.driver.sleep(100);
            const element = await this.driver.findElement(By.id(TASK_PROGRESS_ELEMENT_ID));
            await this.driver.wait(until.elementTextIs(element, 'In Progress'), 4000);
          } catch (e) {
            console.warn(e);
          }
        }

        return status;
      });
  }

  async setTaskStatusInCodeReview() {
    return this.driver.findElement(By.id(TASK_PROGRESS_ELEMENT_ID))
      .then(async element => {
        const status = await element.getText();

        if (status.toLowerCase() !== 'in code review') {
          const moreOptions = await this.driver.findElement(By.id('opsbar-transitions_more'));
          await moreOptions.click();
          const setInCodeReviewButton = await this.driver.findElement(By.id('action_id_101'));
          await setInCodeReviewButton.click();

          try {
            await this.driver.sleep(100);
            const element = await this.driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID));
            await this.driver.wait(until.elementTextIs(element, 'IN CODE REVIEW'), 4000);
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
    await this.driver.sleep(500);
    const logWorkButton = await this.driver.findElement(By.css('.issueaction-log-work'));
    await logWorkButton.click();

    await this.driver.wait(until.elementLocated(By.css('form#log-work')), 5000);

    const form = await this.driver.findElement(By.css('form#log-work'));
    await form.findElement(By.id('log-work-time-logged')).then(async (element) => {
      await this.driver.sleep(1500);
      return element.sendKeys(`${logTime}h`);
    });
    await form.findElement(By.id('comment')).then((element) => {
      return element.sendKeys(`${description}`);
    });

    const logWorkSubmit = await form.findElement(By.id('log-work-submit'));
    await logWorkSubmit.click();
    await this.driver.sleep(500);
    await this.driver.findElements(By.id('log-work-time-logged-error'))
      .then((elements) => {
        if (elements.length > 0) {
          return this.driver.sleep(10000)
            .then(() => {
              throw new Error(`Failed logging work. Errors encountered.`);
            });
        }
      });
    await this.driver.sleep(1000);
  }

  getPathCloneLogsFrom(startDate, endDate) {
    return `plugins/servlet/ac/timereports/timereports#!numOfWeeks=1&pivotTableType=Timesheet&sum=day&endDate=${endDate}&showWeekends=true&startDate=${startDate}`;
  }

  async acquireLogs(getTargetTask, startDate, endDate) {
    const logMap = {};

    await this.driver.wait(until.elementLocated(By.css('iframe'), 10000));
    const iframe = await this.driver.findElement(By.css('iframe'));

    await this.driver.switchTo().frame(iframe);

    await this.driver.wait(until.elementLocated(By.css('button.aui-button.ng-binding')), 10000);
    await this.driver.findElement(By.css('button.aui-button.ng-binding')).click();

    await this.driver.wait(until.elementLocated(By.css('.editWorklogPopup')), 10000);

    const elements = await this.driver.findElements(By.css('.editWorklogPopup'));
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
