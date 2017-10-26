'use strict'

var SiteBuilder = require('./lib/site-builder')
var webhooks = require('./lib/webhooks')
var packageInfo = require('./package.json')
var webhookValidator = require('github-webhook-validator')

var exports = module.exports = {}

exports.versionString = function() {
  return packageInfo.name + ' v' + packageInfo.version
}

exports.launchServer = function(config) {
  SiteBuilder.setConfiguration(config)
  return loadKeyDictionary(config)
    .then(function(keys) {
      return doLaunch(config, webhooks.createImpl(config.webhookType), keys)
    })
    .catch(function(err) {
      console.error('Failed to start server:', err)
    })
}

function loadKeyDictionary(config) {
  return new Promise(function(resolve) {
    if (config.secretKeyFile === null) {
      return resolve()
    }
    return resolve(webhookValidator.loadKeyDictionary(config.secretKeyFile,
      config.builders))
  })
}

function doLaunch(config, webhookImpl, keyDictionary) {
  var parserOpts = { limit: config.payloadLimit },
      server

  if (keyDictionary !== undefined) {
    parserOpts.verify = webhookValidator.middlewareValidator(keyDictionary)
  }
  server = webhooks.createListener(webhookImpl, parserOpts, config)

  console.log(exports.versionString())
  console.log(config.gitUrlPrefix + ' pages: listening on port ' +
    server.address().port)
  return server
}
