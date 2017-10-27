'use strict'

module.exports = BitbucketWebhook

function BitbucketWebhook() {
}

BitbucketWebhook.prototype.isValidWebhook = function(hook) {
  return hook.refChanges !== undefined
}

BitbucketWebhook.prototype.getBranch = function(hook) {
  return hook.refChanges[0].refId
}

BitbucketWebhook.prototype.getParent = function(hook) {
  return hook.repository.project.key.toLowerCase()
}
