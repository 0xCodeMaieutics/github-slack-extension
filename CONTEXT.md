# GitHub Slack Extension

A Chromium browser extension for asking Reviewers on Slack to review a GitHub pull request, straight from its PR Page.

## Language

**PR Page**:
A GitHub pull request page on github.com (`github.com/<owner>/<repo>/pull/<number>`).
_Avoid_: PR view, PR screen

**Request Review Button**:
The Slack-branded button the extension adds to a PR Page whose pull request is open (including drafts), regardless of who authored it.
_Avoid_: Slack button, share button

**Review Request**:
A Slack message asking one or more Reviewers to review a specific pull request. It lives only in Slack and is independent of GitHub's own requested reviewers.
_Avoid_: Ping, notification, share

**Reviewer**:
A Slack workspace member who is asked to review the pull request.
_Avoid_: Colleague, teammate

**Destination**:
Where a Review Request is delivered: either a Slack channel (with Reviewers mentioned) or a separate one-to-one direct message to each Reviewer. Chosen each time a Review Request is sent.
_Avoid_: Target, recipient

**Default Channel**:
The Slack channel the user sets in the extension's settings to be preselected as the Destination. Review Requests themselves are never remembered.
_Avoid_: Last channel, recent channel

**Default Reviewers**:
The Reviewers the user sets in the extension's settings to be preselected on every Review Request. They can still be removed before sending.
_Avoid_: Saved reviewers, favourite reviewers
