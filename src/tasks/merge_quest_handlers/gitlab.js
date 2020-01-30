const config = require('../../config');
const {By, until} = require('selenium-webdriver');
const getBrowser = require('../../get_browser');
const browserUtils = require('../../browser_utils');

async function createMergeRequest(project, currentBranch, targetBranch) {
  let mergeRequestTitle, mergeRequestUrl, additions, removes, likes;

  const url = config.gitlab_url + process.env.GITLAB_NEW_MR_URL
    .replace('{project}', project)
    .replace('{source}', encodeURIComponent(currentBranch))
    .replace('{target}', encodeURIComponent(targetBranch));

  console.log(`Visiting: ${url}`);
  await getBrowser(url, async (driver) => {
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
  });

  return {
    mrTitle: mergeRequestTitle,
    mrRequestUrl: mergeRequestUrl,
    additions: additions,
    removes: removes,
    likes: likes,
  };
}

module.exports = createMergeRequest;
