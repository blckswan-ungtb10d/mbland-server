'use strict'

var path = require('path')
var http = require('http')
var https = require('https')

module.exports = Sync
http.globalAgent.maxSockets = https.globalAgent.maxSockets = 20

function Sync(config, s3client, logger) {
  this.home = config.home
  this.s3 = config.s3
  this.s3client = s3client
  this.logger = logger
}

Sync.prototype.sync = function(buildDestination) {
  var homePrefix = path.join(this.home, path.sep),
      s3Prefix = buildDestination
        .substr(homePrefix.length)
        .replace(/\\/g, '/'),
      s3Path

  if (buildDestination.substr(0, homePrefix.length) !== homePrefix) {
    throw new Error('invalid build destination ' + buildDestination +
      '; should be a subdirectory of ' + this.home)
  }

  if (!this.s3) {
    return Promise.resolve()
  }
  s3Path = 's3://' + this.s3.bucket + '/' + s3Prefix
  this.logger.log('syncing to', s3Path)

  return new Promise((resolve, reject) => {
    var uploader = this.s3client.uploadDir({
      localDir: buildDestination,
      deleteRemoved: true,
      s3Params: {
        Bucket: this.s3.bucket,
        Prefix: s3Prefix
      }
    })

    uploader.on('error', err => {
      reject(new Error('s3 sync failed for ' + s3Path + ': ' + err))
    })
    uploader.on('end', resolve)
  })
}
