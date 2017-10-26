'use strict';

module.exports = GitHubWebhook;

function GitHubWebhook() {
}

GitHubWebhook.prototype.isValidWebhook = function(hook) {
  return hook.repository !== undefined;
};

GitHubWebhook.prototype.getBranch = function(hook) {
  return hook.ref;
};

GitHubWebhook.prototype.getParent = function(hook) {
  return hook.repository.organization;
};
