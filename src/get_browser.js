const conf = require('./init');
require('chromedriver');
const {Builder} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PrettyError = require('pretty-error');
const pe = new PrettyError();

const COOKIES_PATH = conf.store_path + "/cookies/{name}.json";

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}


module.exports = async function (url, task) {
  let driver;
  let domain = url.replace(/^https?:\/\/([^\/]+).*$/, '$1');
  let cookiePath = COOKIES_PATH.replace('{name}', domain);

  const close = async () => {
    const cookies = await driver.manage().getCookies();
    ensureDirectoryExistence(cookiePath);
    fs.writeFileSync(cookiePath, JSON.stringify(cookies));

    await driver.quit()
      .catch(e => {console.error(pe.render(e));})
  };

  const bootBrowser = async () => {
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
        cookies.forEach((cookie) => {
          if (cookiesPerDomain[cookie.domain]) {
            cookiesPerDomain[cookie.domain].push(cookie)
          } else {
            cookiesPerDomain[cookie.domain] = [cookie]
          }

          if (cookie['sameSite'] === 'None') {
            delete cookie['sameSite'];
          }
        });

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
      console.error(pe.render(e));
      if (e.message.indexOf('terminated early') !== -1) {
        return await bootBrowser();
      } else if (e.message.indexOf('user data directory is already in use') !== -1) {
        throw new Error("Please close existing automated chrome windows in order to start the script!");
      }
      throw new Error("Browser failed starting");
    }
  };

  try {
    await bootBrowser();
  } catch (e) {
    console.error(pe.render(e));
    process.exit(2);
  }

  const doProcess = async () => {
    try {
      console.log(`Visiting: ${url}`);
      await driver.get(url);

      let currentUrl;
      do {
        currentUrl = await driver.getCurrentUrl();
      }  while (url !== currentUrl);

      await task(driver, close);
    } catch (e) {
      console.error(pe.render(e));

      if (e.name !== "NoSuchWindowError") {
        await driver.sleep(10000);
      }
      e.isLogged = true;

      throw e;
    } finally {
      await close();
    }
  };

  await doProcess();
};
