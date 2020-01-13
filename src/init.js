const os = require('os');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: __dirname + '/../.env' });

const STORE_PATH = path.join(os.homedir(), '.workflo');

if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH);
}

module.exports = {
  store_path: STORE_PATH,
};
