'use strict'

// Parses POST service webhooks for Bitbucket Server
// https://confluence.atlassian.com/bitbucketserver/
//   post-service-webhook-for-bitbucket-server-776640367.html
module.exports = function(hook) {
  var refChanges = hook.refChanges,
      repository = hook.repository,
      changesets = hook.changesets,
      repoName,
      project,
      commit

  if ([refChanges, repository, changesets].indexOf(undefined) !== -1 ||
      !changesets.isLastPage) {
    return null
  }

  repoName = repository.slug
  project = repository.project.key.toLowerCase()
  commit = changesets.values[0].toCommit

  return {
    branch: refChanges[0].refId,
    parent: project,
    repository: {
      name: repoName,
      fullName: project + '/' + repoName
    },
    commit: {
      id: commit.id,
      message: commit.message,
      timestamp: commit.authorTimestamp
    },
    committer: {
      name: commit.author.name,
      email: commit.author.emailAddress
    }
  }
}
