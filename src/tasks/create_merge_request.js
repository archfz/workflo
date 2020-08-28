const conf = require('../init');
const config = require('../config');
const {By, until} = require('selenium-webdriver');
const getBrowser = require('../get_browser');
const browserUtils = require('../browser_utils');
const axios = require('axios');
const JiraHandler = require('./source_jira_handlers/handler');

const MERGE_REQUEST_CREATION_HANDLERS = {
  "gitlab": require('./merge_quest_handlers/gitlab'),
  "bitbucket": require('./merge_quest_handlers/bitbucket'),
};

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

  const jiraUrl = config.source_jira_url + "/browse/" + taskId;
  await getBrowser(jiraUrl, async (driver) => {
    const handler = new JiraHandler(driver);
    taskTitle = await handler.acquireTaskTitle();

    await handler.setTaskStatusInCodeReview(driver);

    const parentLink = await handler.acquireParentTaskLink();
    if (parentLink) {
      await browserUtils.navigateToLink(driver, parentLink);
      await handler.setTaskStatusInCodeReview().catch((e) => {
        console.error(e);
        console.error('Failed setting parent in progress.');
      });
    }
  }).catch((error) => {
    console.error("Failed setting task status.", error);
  });

  const data = await MERGE_REQUEST_CREATION_HANDLERS[repoType](project, currentBranch, targetBranch);
  console.log('Merge request data:');
  console.log(data);

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

    const message = `>:robot_face:  :page_facing_up:\`-${removes}\` \`+${additions}\`  {${project}} *${taskId}: ${titleTrimmed}* ${mergeRequestUrl} `.replace(/\n/g, '') + '|\n';
    console.log(`Writing to slack: ${message}`);

    const input = driver.findElement(By.css(process.env.SLACK_MESSAGE_INPUT_SELECTOR));
    await input.clear();

    const messageParts = message.split(/([*`>:])/);

    for (let i = 0; i < messageParts.length; i++) {
      const input = driver.findElement(By.css(process.env.SLACK_MESSAGE_INPUT_SELECTOR));
      await input.sendKeys(messageParts[i]);
      await driver.sleep(20);
    }

    await driver.sleep(2000);
  });

})().catch(e => {
  !e.isLogged && console.error(e);

  process.exit(1);
});
