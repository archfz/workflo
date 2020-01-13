const conf = require('../init');
const inquirer = require('inquirer');
const fs = require('fs');

async function configure() {
  let allAnswers = {};
  console.log("Configuring merge requests: ");

  await inquirer
    .prompt([
      {
        type: "input",
        name: "gitlab_url",
        message: "Gitlab URL",
        default: "https://gitlab.pitechplus.com",
      },
      {
        type: "input",
        name: "slack_channel",
        message: "Slack channel. This is where the merge request link will be posted.",
        default: "https://app.slack.com/client/T0YCCJBNU/CMP9ANG9E",
      },
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
        default: "firstname.lastname",
      },
      {
        type: "input",
        name: "jira_clone_approver_id",
        message: "Jira billing approver id. This is the approver user for your weekly billing. Go to jira > inspect the approver select > copy the select option value.",
        default: "rnegrean",
      },
      {
        type: "input",
        name: "jira_clone_target_default_job",
        message: "Jira default task ID. The default target jira task ID on which to clone logs.",
        default: "SAUP-4",
      },
      {
        type: "input",
        name: "jira_clone_task_to_task_map",
        message: "Jira task to task mapping. Map between source and target task IDs. Needs to be a valid JSON. The keys in the object are regex. Ex: {\"INCH-4\":\"SAUP-7\"}",
        validate: (input) => {
          try {JSON.parse(input);} catch (e) {return "Incorrect JSON.";}
          return true;
        },
        default: "{}",
      },
      {
        type: "input",
        name: "jira_clone_job_to_task_map",
        message: "Jira task to task mapping. Map between source job and target task ID. Needs to be a valid JSON. The keys in the object are regex. Ex: {\".*700263.*\":\"DC-8\"}",
        validate: (input) => {
          try {JSON.parse(input);} catch (e) {return "Incorrect JSON.";}
          return true;
        },
        default: "{\".*700263.*\":\"DC-8\"}",
      },
    ])
    .then(answers => allAnswers = {...allAnswers, ...answers});

  console.log("");
  console.log("All answers:", allAnswers);
  fs.writeFileSync(conf.store_path + "/config.json", JSON.stringify(allAnswers, null, 2));
}

configure();
