'use strict'

var SiteBuilder = require('./lib/site-builder')
var webhooks = require('./lib/webhooks')
var packageInfo = require('./package.json')
var webhookValidator = require('github-webhook-validator')
var express = require('express')
var bodyParser = require('body-parser')
var morgan = require('morgan')

var exports = module.exports = {}

exports.versionString = function() {
  return packageInfo.name + ' v' + packageInfo.version
}

exports.launchServer = function(config) {
  SiteBuilder.setConfiguration(config)
  return loadKeyDictionary(config)
    .then(function(keyDictionary) {
      return doLaunch(config, keyDictionary)
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

function doLaunch(config, keyDictionary) {
  var parserOpts = { limit: config.payloadLimit },
      app = express(),
      handler = webhooks.createHandler(config),
      server

  if (keyDictionary !== undefined) {
    parserOpts.verify = webhookValidator.middlewareValidator(keyDictionary)
  }
  app.use(morgan('combined'))
  app.use(bodyParser.json(parserOpts))

  app.post('/', function(req, res) {
    handler(req.body, status => res.sendStatus(status))
      .catch(err => console.error(err))
  })

  server = app.listen(config.port)
  console.log(exports.versionString())
  console.log(config.gitUrlPrefix + ' pages: listening on port ' +
    server.address().port)
  return server
}
