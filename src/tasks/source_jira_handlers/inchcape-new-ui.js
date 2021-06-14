const {By, until} = require('selenium-webdriver');

module.exports = class InchcapeNewUiJira {
  constructor(driver) {
    this.driver = driver;
  }

  async acquireTaskTitle() {
    await this.driver.wait(until.elementLocated(By.css('[data-test-id="issue.views.issue-base.foundation.summary.heading"]')), 10000);

    return this.driver.findElement(By.css('[data-test-id="issue.views.issue-base.foundation.summary.heading"]'))
      .then((element) => element.getText());
  }

  async acquireTaskType() {
    return this.driver.findElement(By.css('[data-test-id="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"] img'))
      .then((element) => element.getAttribute('alt'));
  }

  async acquireParentTaskLink() {
    const parents = await this.driver.findElements(By.css('[data-test-id="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-parent-issue-container"] a'));
    if (parents.length > 0) {
      return this.driver.findElement(By.css('[data-test-id="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-parent-issue-container"] a'));
    }
    return null;
  }

  async assignSelfToTask() {
    let assignContainer = await this.driver.findElement(By.css('[data-test-id="issue.views.field.user.assignee"]'));
    await assignContainer.click();
    const firstOption = await this.driver.findElement(By.css('[id="react-select-assignee-option-0"]'))
    const optionValue = await firstOption.getText();

    if (optionValue === 'Unassigned') {
      await firstOption.click();
      let assignContainer = await this.driver.findElement(By.css('[data-test-id="issue.views.field.user.assignee"]'));
      await assignContainer.click();
      await this.driver.findElement(By.css('[id="react-select-assignee-option-0"]')).click();
    } else {
      await firstOption.click();
    }
  }

  async setTaskStatusInProgress() {
    return this.driver.findElement(By.css('[data-test-id="issue.views.issue-base.foundation.status.status-field-wrapper"]'))
      .then(async element => {
        const status = await element.getText();

        console.log(`Task current status is: ${status}.`);
        if (status.toLowerCase() !== 'in progress') {
          await element.click();
          const startProgressBtn = await this.driver.findElement(
            By.xpath('//div[@data-test-id=\'issue.fields.status.common.ui.status-lozenge.4\']//span[contains(text(), \'In Progress\')]')
          );
          await startProgressBtn.click();

          try {
            await this.driver.sleep(100);
            const element = await this.driver.findElement(By.css('[data-test-id="issue.views.issue-base.foundation.status.status-field-wrapper"]'));
            await this.driver.wait(until.elementTextIs(element, 'In Progress'), 4000);
          } catch (e) {
            console.warn(e);
          }
        }

        return status;
      });
  }

  async setTaskStatusInCodeReview() {
    return this.driver.findElement(By.css('[data-test-id="issue.views.issue-base.foundation.status.status-field-wrapper"]'))
      .then(async element => {
        const status = await element.getText();

        if (status.toLowerCase() !== 'in code review') {
          await element.click();
          const startProgressBtn = await this.driver.findElement(
            By.xpath('//div[@data-test-id=\'issue.fields.status.common.ui.status-lozenge.4\']//span[contains(text(), \'IN CODE REVIEW\')]')
          );
          await startProgressBtn.click();

          try {
            await this.driver.sleep(100);
            const element = await this.driver.findElement(By.css('[data-test-id="issue.views.issue-base.foundation.status.status-field-wrapper"]'));
            await this.driver.wait(until.elementTextIs(element, 'IN CODE REVIEW'), 4000);
          } catch (e) {
            console.warn(e);
          }
        }

        return status;
      });
  }

  /**
   * @TODO
   */
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

  /**
   * @TODO
   */
  getPathCloneLogsFrom(startDate, endDate) {
    return `plugins/servlet/ac/timereports/timereports#!numOfWeeks=1&pivotTableType=Timesheet&sum=day&endDate=${endDate}&showWeekends=true&startDate=${startDate}`;
  }

  /**
   * @TODO
   */
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
          element.findElement(By.css(process.env.JIRA_CLONE_TASK_LOG_JOB_SELECTOR)).then(element => element.getAttribute('title').match('^\d+')[0]),
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
