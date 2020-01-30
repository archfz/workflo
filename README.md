# Workflo

Tool for GIT + REPO + JIRA automations. Currently it's specifically designed to 
work with Slack, Gitlab and the Jira of Pitech+Plus and Summit.

> NOTE: This tool is highly unstable and potential bugs always come up since it
depends on 3rd party UI.

- [Requirements](#requirements)
- [Installation](#installation)
- [Commands](#Commands)
- [Upcomming features](#upcomming-features)
- [Release Notes](#release-notes)

## Requirements

The tool uses selenium webdriver and it connects to chrome. Every action opens one or 
more instances of browsers to perform the otherwise manual operations. It cannot do 
authentications so any page visited that requires that you first login. When starting
a task and you have to login, in many cases after you've logged in you will have to 
retry the command.

- Npm and node:^8.
- Chrome browser to be installed.
- User account on dependent sites: gitlab, source+target JIRA, slack. 
- Manual login and relogin when sessions expire on the start of the automation.
- For commands that run in git repository branch names need to respect the following 
formats: .\*(story|\[-_\]{1}task|bug)\/(\[A-Za-z]+\-\[0-9]+).\*.
Ex: *story/INCHD-1111_some_description_of_branch*. Only this way can the tool map your
branch and commits to a JIRA task. The `wfs` command creates branch name respecting
this format.

## Installation

1. Install npm packages:
   ```bash
   npm install -g fzuzzy-workflo
   ```
1. Run the configuration helper. Provide the values carefully.
   ```bash
   wfconfigure 
   ```

## Commands

__Commands that need to be used from the git repository directory:__


```bash
wfs [task-id] [tracking-branch]
```
- Creates new branch for task with standard {task_type}/{task_id}_{description}
- Puts task in progress in jira if it can.

```bash
wfp [log-hours?]
```
- Pushes to HEAD and creates merge request.
- Posts it in code reviews slack channel.
- Puts the task in code review status in jira if it can.
- Logs time in hours on task if second argument provided.

```bash
wfc [description] [log-hours?]
```
- Shorthand for commit which adds task ID automatically to log description.
- Logs time in hours on jira task if second argument provided.

```bash
wfl [log-hour]
```
- Logs time on jira task based on current commit description.
    
__Commands usable globally:__
    
```bash
wfconfigure
```
- Configures this tool by CLI form.

```bash
wfclonelog [fromDate?] [toDate?]
```
- Clones logs from Summit JIRA to pitech JIRA, so that you only have to manually add
logs to one jira.
- Gathers data from source, outputs the logs that will be created and awaits confirmation
whether to proceed to create those logs in the target jira.
- Reads from the configuration you provided the default target task and mappings based on
task ID and task job ID (task job ID has higher priority).
- From date and to date default to end and start of current week. Date format YYYY-mm-dd.
- If to date equals friday then the approval for the billing week is submitted. Also
adds as comment a random joke so that the reviewer has a better time :).
- Optionally you can provide the exact dates to clone in cases like
where only part of the week needs to be cloned or when weekends have logs as
well.

## Upcomming features

- Detection for login screens and await until the user logs in before attempting to
execute the required action set. 
- Maybe support for different messaging apps: +Skype.

## Release notes

> NOTE!!: After upgrading always run `wfconfigure`

#### 1.2.0

- Added option to configure which mapping should be with higher priority when cloning 
logs.
- Added support for creating merge requests with bitbucket.  
