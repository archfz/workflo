const conf = require('../init');
const config = require('../config');
const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');
const browserUtils = require('../browser_utils');
const axios = require('axios');

const MERGE_REQUEST_CREATION_HANDLERS = {
  "gitlab": require('./merge_quest_handlers/gitlab'),
  "bitbucket": require('./merge_quest_handlers/bitbucket'),
};

async function setTaskStatusInCodeReview(driver) {
  return driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID))
    .then(async element => {
      const status = await element.getText();

      if (status.toLowerCase() !== process.env.TASK_IN_CODE_REVIEW_LABEL.toLowerCase()) {
        const moreOptions = await driver.findElement(By.id(process.env.MORE_WORKLOW_OPTION_BUTTON_ID));
        await moreOptions.click();
        const setInCodeReviewButton = await driver.findElement(By.id(process.env.SET_IN_CODEREVIEW_BUTTON_ACTION_ID));
        await setInCodeReviewButton.click();

        try {
          await driver.sleep(100);
          const element = await driver.findElement(By.id(process.env.TASK_PROGRESS_ELEMENT_ID));
          await driver.wait(until.elementTextIs(element, process.env.TASK_IN_CODE_REVIEW_LABEL), 4000);
        } catch (e) {
          console.warn(e);
        }
      }

      return status;
    });
}

(async function () {
  const taskId = process.argv[2];
  const project = process.argv[3];
  const repoType = process.argv[4];
  const currentBranch = process.argv[5];
  const targetBranch = process.argv[6];

  if (!MERGE_REQUEST_CREATION_HANDLERS[repoType]) {
    throw new Error(`Repo type '${repoType}' is not supported for merge request creation.`);
  }

  let mergeRequestTitle, mergeRequestUrl, additions, removes, likes, taskTitle;

  const jiraUrl = process.env.JIRA_BASE_URL + "/browse/" + taskId;
  await getBrowser(jiraUrl, async (driver) => {
    await driver.wait(until.elementLocated(By.id(process.env.TASK_TITLE_ELEMENT_ID)), 10000);
    const titleElement = await driver.findElement(By.id(process.env.TASK_TITLE_ELEMENT_ID));
    taskTitle = await titleElement.getText();

    await setTaskStatusInCodeReview(driver);

    const parents = await driver.findElements(By.id(process.env.LINK_PARENT_ISSUE_ID));
    if (parents.length > 0) {
      const link = driver.findElement(By.id(process.env.LINK_PARENT_ISSUE_ID));
      await browserUtils.navigateToLink(driver, link);
      await setTaskStatusInCodeReview(driver);
    }
  }).catch((error) => {
    console.error("Failed setting task status.", error);
  });

  const data = await MERGE_REQUEST_CREATION_HANDLERS[repoType](project, currentBranch, targetBranch);
  const shortUrlPost = 'http://tinyurl.com/api-create.php?url=' + encodeURIComponent(data.mrRequestUrl);
  console.log(`Acquiring short url from: ${shortUrlPost}`);
  await axios.get(shortUrlPost)
    .then((resp) => {
      likes = data.likes;
      additions = data.additions;
      removes = data.removes;
      mergeRequestTitle = data.mrTitle;
      mergeRequestUrl = resp.data;
    });

  await getBrowser(config.slack_channel, async (driver) => {
    await driver.wait(until.elementLocated(By.css(process.env.SLACK_MESSAGE_INPUT_SELECTOR)), 10000);
    const titleTrimmed = taskTitle.length > 42 ? taskTitle.slice(0, 42) + ".." : taskTitle;

    const message = `>:robot_face:  needs \`${2 - likes}\`:thumbsup_all:  :page_facing_up:\`-${removes}\` \`+${additions}\`  *${taskId}: ${titleTrimmed}* ${mergeRequestUrl} `.replace(/\n/g, '') + '\n';
    console.log(`Writing to slack: ${message}`);

    // const input = driver.findElement(By.css(process.env.SLACK_MESSAGE_INPUT_SELECTOR));
    // await input.clear();
    //
    // const messageParts = message.split(/([*`>:])/);
    //
    // for (let i = 0; i < messageParts.length; i++) {
    //   const input = driver.findElement(By.css(process.env.SLACK_MESSAGE_INPUT_SELECTOR));
    //   await input.sendKeys(messageParts[i]);
    //   await driver.sleep(20);
    // }

    await driver.sleep(2000);
  });

})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
