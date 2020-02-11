const config = require('../../config');
const {By, until} = require('selenium-webdriver');
const getBrowser = require('../../get_browser');
const browserUtils = require('../../browser_utils');

async function createMergeRequest(project, currentBranch, targetBranch) {
  let mergeRequestTitle, mergeRequestUrl, additions = 0, removes = 0, likes;

  const url = config.bitbucket_url + process.env.BITBUCKET_NEW_MR_URL
    .replace('{project}', project)
    .replace('{source}', currentBranch)
    .replace('{target}', targetBranch);

  console.log(`Visiting: ${url}`);
  await getBrowser(url, async (driver) => {
    await driver.wait(until.elementLocated(By.id(process.env.BITBUCKET_MR_FORM_ID)), 10000);
    await driver.sleep(1000);

    await driver.wait(until.elementLocated(By.css(`${process.env.BITBUCKET_MR_CLOSE_BRANCH_SELECTOR}:not(:disabled)`)), 20000);
    await driver.findElement(By.css(`${process.env.BITBUCKET_MR_CLOSE_BRANCH_SELECTOR}`))
      .then((element) => {
        element.getAttribute('checked')
          .then((attr) => {
            !attr && element.click()
          })
      });

    await driver.wait(until.elementLocated(By.css(`#${process.env.BITBUCKET_MR_FORM_ID} [type='submit']:not(:disabled)`)), 20000);
    const submit = await driver.findElement(By.css(`#${process.env.BITBUCKET_MR_FORM_ID} [type='submit']`));

    await driver.sleep(1500);
    await submit.click();

    await browserUtils.awaitUrlChange(driver);

    await driver.wait(until.elementLocated(By.css(process.env.BITBUCKET_MR_TITLE_SELECTOR)), 70000);
    const title = await driver.findElement(By.css(process.env.BITBUCKET_MR_TITLE_SELECTOR));
    mergeRequestTitle = await title.getAttribute("innerHTML");
    mergeRequestUrl = await driver.getCurrentUrl();

    const likesElement = await driver.findElement(By.css(process.env.BITBUCKET_MR_LIKES_SELECTOR));
    likes = await likesElement.getText();


    try {
      await driver.wait(until.elementLocated(By.xpath("//h1[contains(text(), \"Files changed\")]")), 25000);
    } catch (e) {
      console.error(e);
      additions = '∞';
      removes = '∞';
      return;
    }

    await driver.wait(until.elementLocated(By.css(process.env.BITBUCKET_CHANGES_ADDITIONS_SELECTOR)), 10000);
    await driver.wait(until.elementLocated(By.css(process.env.BITBUCKET_CHANGES_REMOVES_SELECTOR)), 10000);

    additions = await driver.executeScript(`return Array.from(document.querySelectorAll('${process.env.BITBUCKET_CHANGES_ADDITIONS_SELECTOR}')).reduce((total, item) =>  (Number.parseInt(item.innerHTML, 10) || 0) + total, 0)`);
    removes = await driver.executeScript(`return Array.from(document.querySelectorAll('${process.env.BITBUCKET_CHANGES_REMOVES_SELECTOR}')).reduce((total, item) =>  (Number.parseInt(item.innerHTML, 10) || 0) + total, 0)`);
    removes = -removes;
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
