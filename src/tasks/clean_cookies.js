const conf = require('../init');
const fs = require('fs');
const path = require('path');

const COOKIES_PATH = conf.store_path + "/cookies";

if (fs.existsSync(COOKIES_PATH)) {
  fs.readdir(COOKIES_PATH, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(COOKIES_PATH, file), err => {
        if (err) throw err;
      });
    }
  });
}

