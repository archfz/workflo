const conf = require('../init');
const config = require('../config');
const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');
const browserUtils = require('../browser_utils');
const axios = require('axios');

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
  const currentBranch = process.argv[4];
  const targetBranch = process.argv[5];


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

  const gitlabUrl = config.gitlab_url + process.env.GITLAB_NEW_MR_URL
    .replace('{project}', project)
    .replace('{source}', encodeURIComponent(currentBranch))
    .replace('{target}', encodeURIComponent(targetBranch));
  await getBrowser(gitlabUrl, async (driver) => {
    await driver.wait(until.elementLocated(By.id(process.env.GITLAB_MR_FORM_ID)), 10000);
    const submit = await driver.findElement(By.css(`#${process.env.GITLAB_MR_FORM_ID} [type='submit']`));

    // Intended.
    await driver.sleep(1000);
    await submit.click();

    await browserUtils.awaitUrlChange(driver);

    const body = await driver.findElement(By.css('body'));
    const text = await body.getText();

    if (text.match(new RegExp(process.env.GITLAB_MR_EXISTS_REGEX))) {
      const mrId = text.match(new RegExp(process.env.GITLAB_MR_EXISTS_REGEX))[1];
      const mrUrl = config.gitlab_url + process.env.GITLAB_MR_URL
        .replace('{project}', project)
        .replace('{id}', mrId);
      await browserUtils.navigateToUrl(driver, mrUrl);
    }

    const title = await driver.findElement(By.css(process.env.GITLAB_MR_TITLE_SELECTOR));
    mergeRequestTitle = await title.getAttribute("innerHTML");
    mergeRequestUrl = await driver.getCurrentUrl();

    const likeButton = await driver.findElement(By.css(process.env.GITLAB_MR_LIKES_SELECTOR));
    likes = await likeButton.getText();
    const changesButton = await driver.findElement(By.css(process.env.GITLAB_CHANGE_LINK_SELECTOR));
    await changesButton.click();
    await driver.wait(until.elementLocated(By.css(process.env.GITLAB_CHANGES_ADDITIONS_SELECTOR)), 10000);
    const additionsContainer = await driver.findElement(By.css(process.env.GITLAB_CHANGES_ADDITIONS_SELECTOR));
    additions = await additionsContainer.getText();
    const removesContainer = await driver.findElement(By.css(process.env.GITLAB_CHANGES_REMOVES_SELECTOR));
    removes = await removesContainer.getText();

    await axios.get('http://tinyurl.com/api-create.php?url=' + encodeURIComponent(mergeRequestUrl))
      .then((resp) => {
        mergeRequestUrl = resp.data;
      });
  });

  await getBrowser(config.slack_channel, async (driver) => {
    await driver.wait(until.elementLocated(By.css(process.env.SLACK_MESSAGE_INPUT_SELECTOR)), 10000);
    const input = driver.findElement(By.css(process.env.SLACK_MESSAGE_INPUT_SELECTOR));

    const titleTrimmed = taskTitle.length > 42 ? taskTitle.slice(0, 42) + ".." : taskTitle;

    const message = `>:robot_face:  needs \`${2 - likes}\`:thumbsup_all:  :page_facing_up:\`-${removes}\` \`+${additions}\`  *${taskId}: ${titleTrimmed}* ${mergeRequestUrl}`.replace(/\n/g, '') + '\n';
    await input.sendKeys(message);
  });

})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
