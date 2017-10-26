'use strict'

var SiteBuilder = require('./site-builder')

exports = module.exports = {}

// Parses the last component from gitUrlPrefix, which represents either a
// username, organization, or project.
exports.parentFromGitUrlPrefix = function(gitUrlPrefix) {
  return gitUrlPrefix.replace(/\/$/, '').split(/[:/]/).pop().toLowerCase()
}

// Returns a new instance of a webhook implementation object.
//
// `webhookType` must match one of the module names in `lib/webhooks`; not case
// sensitive.
exports.createImpl = function(webhookType) {
  try {
    var Impl = require('./webhooks/' + (webhookType || 'github').toLowerCase())
    return new Impl
  } catch (_) {
    throw new Error('Unknown webhookType: ' + webhookType)
  }
}

// Returns a function that builds webhooks matching the configuration
//
// Values in `builderConfig` will override default values in `config`.
exports.createBuilder = function(webhookImpl, config, builderConfig) {
  var parent = exports.parentFromGitUrlPrefix(
        builderConfig.gitUrlPrefix || config.gitUrlPrefix),
      branchPattern = builderConfig.branchInUrlPattern || builderConfig.branch,
      branchRegexp = new RegExp('refs/heads/(' + branchPattern + ')$')

  return function(hook) {
    var branch = branchRegexp.exec(webhookImpl.getBranch(hook))

    if (branch && (webhookImpl.getParent(hook) === parent)) {
      return SiteBuilder.launchBuilder(hook, branch[1], builderConfig)
    } else {
      return Promise.resolve()
    }
  }
}

// Runs all builders matching a valid webhook
//
// If the webhook is valid, send will receive a 202 (Accepted) status, and the
// function will return a Promise that resolves when all matching builders are
// finished.
//
// Otherwise `send` will receive a 400 (Bad Request) status, and the function
// returns an empty resolved Promise.
exports.handleWebhook = function(hook, impl, builders, send) {
  if (!impl.isValidWebhook(hook)) {
    send(400)
    return Promise.resolve()
  }
  send(202)
  return Promise.all(builders.map(builder => builder(hook)))
}

// Returns a (hook, send) that will respond to hooks matching the configuration
//
// Instantiates a webhook implementation and generates a list of builders based
// on `config` for the returned closure.
//
// The `send` argument and returned Promises are identical to those from
// `handleWebhook`.
exports.createHandler = function(config) {
  var impl = exports.createImpl(config.webhookType),
      builders = config.builders.map(builder => {
        return exports.createBuilder(impl, config, builder)
      })
  return (hook, send) => exports.handleWebhook(hook, impl, builders, send)
}
