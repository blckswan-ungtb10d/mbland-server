'use strict'

var fs = require('fs')
var log = require('winston')

module.exports = BuildLogger

// Message logger that logs both to the main logger and a repo-specific
// build.log.
function BuildLogger(logFilePath) {
  if (logFilePath) {
    this.logFile = fs.createWriteStream(logFilePath, { flags: 'a' })
  } else {
    this.logFile = {
      write: function() {
      },
      on: function(unused, callback) {
        this.callback = callback
      },
      end: function() {
        this.callback()
      }
    }
  }
}

BuildLogger.prototype.log = function() {
  log.info.apply(log, arguments)
  writeToLogFile.apply(this.logFile, arguments)
}

BuildLogger.prototype.error = function() {
  log.error.apply(log, arguments)
  writeToLogFile.apply(this.logFile, arguments)
}

BuildLogger.prototype.close = function(done) {
  this.logFile.on('finish', done)
  this.logFile.end()
}

function writeToLogFile() {
  var i,
      endIndex = arguments.length - 1

  for (i = 0; i !== arguments.length; ++i) {
    this.write(arguments[i])
    if (i !== endIndex) {
      this.write(' ')
    }
  }
  this.write('\n')
}
