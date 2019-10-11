module.exports = {
  async navigateToUrl(driver, url) {
    await driver.navigate().to(url);
    await this.awaitUrlChange(driver);
  },

  async navigateToLink(driver, link) {
    await this.navigateToUrl(driver, await link.getAttribute("href"));
    await this.awaitUrlChange(driver);
  },

  async awaitUrlChange(driver) {
    const currentUrl = await driver.getCurrentUrl();
    let nextUrl;
    do {
      await driver.sleep(100);
      nextUrl = await driver.getCurrentUrl();
    }  while (nextUrl !== currentUrl);

    let state;
    do {
      await driver.sleep(100);
      state = await driver.executeScript("return document.readyState");
    }  while (state !== "complete");
  }
};
