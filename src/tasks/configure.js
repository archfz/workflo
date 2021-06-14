const conf = require('../init');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
let config = {};

const CONFIG_PATH = path.join(conf.store_path, 'config.json');

if (fs.existsSync(CONFIG_PATH)) {
  config = require(CONFIG_PATH);
}

async function configure() {
  let allAnswers = {};
  console.log("Configuring merge requests: ");

  await inquirer
    .prompt([
      {
        type: "input",
        name: "gitlab_url",
        message: "Gitlab URL",
        default: config.gitlab_url || "https://gitlab.pitechplus.com",
      },
      {
        type: "input",
        name: "bitbucket_url",
        message: "Bitbucket URL",
        default: config.bitbucket_url || "https://bitbucket.org",
      },
      {
        type: "input",
        name: "slack_channel",
        message: "Slack channel. This is where the merge request link will be posted.",
        default: config.slack_channel || "https://app.slack.com/client/T0YCCJBNU/CMP9ANG9E",
      },
    ])
    .then(answers => allAnswers = {...allAnswers, ...answers});

  console.log("");
  console.log("Configuring source JIRA: ");

  await inquirer
    .prompt([
      {
        type: "input",
        name: "source_jira_url",
        message: "Source Jira URL",
        validate: (value) => !!value || "Invalid source URL.",
        default: config.source_jira_url || "",
      },
      {
        type: "list",
        choices: ["inchcape", "inchcape-new-ui", "summit"],
        name: "source_jira_handler",
        message: "Source JIRA handler",
        default: config.source_jira_handler || "inchcape",
      }
    ])
    .then(answers => allAnswers = {...allAnswers, ...answers});

  console.log("");
  console.log("Configuring JIRA log cloner: ");

  await inquirer
    .prompt([
      {
        type: "input",
        name: "jira_clone_target_username",
        message: "Jira target username",
        default: config.jira_clone_target_username || "firstname.lastname",
      },
      {
        type: "input",
        name: "jira_clone_approver_id",
        message: "Jira billing approver id. This is the approver user for your weekly billing. Go to jira > inspect the approver select > copy the select option value.",
        default: config.jira_clone_approver_id || "rnegrean",
      },
      {
        type: "input",
        name: "jira_clone_target_default_job",
        message: "Jira default task ID. The default target jira task ID on which to clone logs.",
        default: config.jira_clone_target_default_job || "SAUP-4",
      },
      {
        type: "input",
        name: "jira_clone_task_to_task_map",
        message: "Jira task to task mapping. Map between source and target task IDs. Needs to be a valid JSON. The keys in the object can be a regex or simple value. Ex: {\"INCHD-4\":\"SAUP-7\"}",
        validate: (input) => {
          try {JSON.parse(input);} catch (e) {return "Incorrect JSON.";}
          return true;
        },
        default: config.jira_clone_task_to_task_map || "{}",
      },
      {
        type: "input",
        name: "jira_clone_job_to_task_map",
        message: "Jira task to task mapping. Map between source job and target task ID. Needs to be a valid JSON. The keys in the object can be a regex or simple value. Ex: {\".*700263.*\":\"DC-8\"}",
        validate: (input) => {
          try {JSON.parse(input);} catch (e) {return "Incorrect JSON.";}
          return true;
        },
        default: config.jira_clone_job_to_task_map || "{\".*700263.*\":\"DC-8\"}",
      },
      {
        type: "list",
        choices: ['job_to_task', 'task_to_task'],
        name: "jira_clone_mapping_priority",
        message: "Jira clone mapping priority. This priority will affect which mapping will be used in order to find a match for target task. ('job_to_task', 'task_to_task')",
        default: config.jira_clone_mapping_priority || "job_to_task",
      },
    ])
    .then(answers => allAnswers = {...allAnswers, ...answers});

  console.log("");
  console.log("All answers:", allAnswers);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(allAnswers, null, 2));
}

configure();
