const conf = require('./init');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(conf.store_path, 'config.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("ERROR: Missing configuration! Please first run: wfconfigure");
  process.exit(1);
}

module.exports = require(CONFIG_PATH);
