require('chromedriver');
const {Builder} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: __dirname + '/../.env' });

const COOKIES_PATH = __dirname + "/../cookies/{name}.json";

module.exports = async function (url, task) {
  let driver;
  let domain = url.replace(/^https?:\/\/([^\/]+).*$/, '$1');
  let cookiePath = COOKIES_PATH.replace('{name}', domain);

  const close = async () => {
    const cookies = await driver.manage().getCookies();
    fs.writeFileSync(cookiePath, JSON.stringify(cookies));

    await driver.quit()
      .catch(e => {console.error(e);})
  };

  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(new chrome.Options()
        .addArguments([`user-data-dir=${os.homedir()}/.config/google-chrome/Default`])
        .addArguments([`disable-popup-blocking`]))
      .build();

    try {
      const cookies = JSON.parse(fs.readFileSync(cookiePath));
      const cookiesPerDomain = {};
      cookies.forEach((cookie) => (cookiesPerDomain[cookie.domain] &&
        cookiesPerDomain[cookie.domain].push(cookie) || (cookiesPerDomain[cookie.domain] = [cookie]))
      );

      await Promise.all(Object.entries(cookiesPerDomain).map(async ([domain, cookies]) => {
        await driver.get("http://" + domain + "/");
        return Promise.all(cookies.map((cookie) => driver.manage().addCookie(cookie)));
      }));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  } catch (e) {
    console.error(e);
    throw new Error("Browser failed starting");
  }

  try {
    await driver.get(url);

    let currentUrl;
    do {
      currentUrl = await driver.getCurrentUrl();
    }  while (url !== currentUrl);

    await task(driver, close);
  } catch (e) {
    console.error(e);

    if (e.name !== "NoSuchWindowError") {
      await driver.sleep(10000);
    }
    e.isLogged = true;

    throw e;
  } finally {
    await close();
  }
};
