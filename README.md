# Workflo

Tool for GIT + REPO + JIRA automations. Currently it's 
specifically designed to work with Slack, Gitlab and the Jira
of Pitech+Plus and Summit.

> NOTE: This tool is highly unstable and potential bugs always
come up.

## Commands

- `wfs [task-id] [tracking-branch]` 
    - Creates new branch for task with standard {task_type}/{task_id}_{description}
    - Puts task in progress if it can.
- `wfp [log-hours?]`
    - Pushes to HEAD and creates merge request.
    - Posts it in code reviews slack channel.
    - Puts the task in code review if it can.
    - Logs time in hours if second argument provided.
- `wfc [description] [log-hours?]` 
    - Shorthand for commit which adds task ID automatically to log description.
    - Logs time in hours if second argument provided.
- `wfclonelog [fromDate?] [toDate?]` 
    - Clones logs from Summit JIRA to pitech JIRA.

> NOTE: The project uses .env and the script can be configured from there: ex
the target slack channel for MRs or the mapping of the jira cloning. 
