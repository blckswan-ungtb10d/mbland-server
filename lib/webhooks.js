'use strict'

var SiteBuilder = require('./site-builder')
var express = require('express')
var bodyParser = require('body-parser')

exports = module.exports = {}

exports.createImpl = function(webhookType) {
  try {
    var Impl = require('./webhooks/' + (webhookType || 'github').toLowerCase())
    return new Impl
  } catch (_) {
    throw new Error('Unknown webhookType: ' + webhookType)
  }
}

exports.createListener = function(webhookImpl, parserOpts, config) {
  var webhook = express()

  webhook.use(bodyParser.json(parserOpts))
  webhook.post('/', function(req, res) {
    if (webhookImpl.isValidWebhook(req.body)) {
      webhook.emit('hook', req.body)
      res.sendStatus(202)
    } else {
      res.sendStatus(400)
    }
  })
  config.builders.forEach(function(builder) {
    webhook.on('hook', createBuilder(webhookImpl, config, builder))
  })
  return webhook.listen(config.port)
}

function createBuilder(webhookImpl, config, builderConfig) {
  var parent = SiteBuilder.parentFromGitUrlPrefix(
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
