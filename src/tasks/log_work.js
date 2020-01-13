const conf = require('../init');
const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');

(async function () {
  const taskId = process.argv[2];
  const description = process.argv[3];
  const logTime = Number.parseFloat(process.argv[4]);

  if (isNaN(logTime) || logTime === 0) {
    throw new Error(`Invalid log time: ${process.argv[4]}`);
  }

  const url = process.env.JIRA_BASE_URL + "/browse/" + taskId;

  await getBrowser(url, async (driver) => {
    await driver.wait(until.elementLocated(By.id(process.env.TASK_TITLE_ELEMENT_ID)), 10000);

    const moreOptionsButton = await driver.findElement(By.id(process.env.TASK_MORE_OPTIONS_BUTTON));
    await moreOptionsButton.click();
    const logWorkButton = await driver.findElement(By.id(process.env.LOG_WORK_SCREEN_BUTTON_ID));
    await logWorkButton.click();

    await driver.wait(until.elementLocated(By.css(process.env.INPUT_LOG_WORK_TIME_SELECTOR)), 5000);

    const form = await driver.findElement(By.css(process.env.FORM_WORKLOG_SELECTOR));
    await form.findElement(By.css(process.env.INPUT_LOG_WORK_TIME_SELECTOR)).then(async (element) => {
      await driver.sleep(100);
      return element.sendKeys(`${logTime}h`);
    });
    await form.findElement(By.css(process.env.INPUT_LOG_WORK_DESCRIPTION_SELECTOR)).then((element) => {
      return element.sendKeys(`${description}`);
    });

    const logWorkSubmit = await form.findElement(By.css(process.env.LOG_WORK_BUTTON_SELECTOR));
    await logWorkSubmit.click();
    await driver.sleep(500);
    await driver.findElements(By.css(process.env.LOG_WORK_ERROR_CONTAINER_SELCTOR + " *"))
      .then((elements) => {
        if (elements.length > 0) {
          return driver.sleep(10000)
            .then(() => {
              throw new Error(`Failed logging work. Errors encountered.`);
            });
        }
      });
    await driver.sleep(2500);
  });
})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
