'use strict'

var BuildLogger = require('../lib/build-logger')
var path = require('path')
var fs = require('fs')
var sinon = require('sinon')
var chai = require('chai')
var log = require('winston')

chai.should()

describe('BuildLogger', function() {
  var logger, logFileDir, logFilePath, captureLogs, checkAndRestoreLogs

  before(function() {
    logFileDir = path.resolve(__dirname, 'buildLogger_test')
    logFilePath = path.resolve(logFileDir, 'build.log')
  })

  beforeEach(function(done) {
    fs.exists(logFileDir, function(exists) {
      (exists ? fs.chmod : fs.mkdir)(logFileDir, '0700', done)
    })
  })

  afterEach(function(done) {
    fs.exists(logFilePath, function(exists) {
      if (exists) { fs.unlink(logFilePath, done) } else { done() }
    })
  })

  after(function(done) {
    fs.exists(logFileDir, function(exists) {
      if (exists) { fs.rmdir(logFileDir, done) } else { done() }
    })
  })

  captureLogs = function() {
    sinon.stub(log, 'info')
    sinon.stub(log, 'error')
  }

  checkAndRestoreLogs = function(done, validate) {
    return function() {
      var err

      try {
        validate()
      } catch (e) {
        err = e
      } finally {
        log.error.restore()
        log.info.restore()
        done(err)
      }
    }
  }

  it('should log everything to the file', function(done) {
    logger = new BuildLogger(logFilePath)
    captureLogs()
    logger.log('This', 'should', 'be', 'logged', 'to', 'the', 'file')
    logger.error('This', 'should', 'also', 'be', 'logged', 'to', 'the', 'file')
    logger.close(checkAndRestoreLogs(done, function() {
      log.info.args.should.eql(
        [['This', 'should', 'be', 'logged', 'to', 'the', 'file']])
      log.error.args.should.eql(
        [['This', 'should', 'also', 'be', 'logged', 'to', 'the', 'file']])
      fs.readFileSync(logFilePath).toString().should.eql(
        'This should be logged to the file\n' +
        'This should also be logged to the file\n')
    }))
  })

  it('should log to a null file', function(done) {
    logger = new BuildLogger()
    captureLogs()
    logger.log('This', 'should', 'be', 'logged', 'to', 'stdout')
    logger.error('This', 'should', 'be', 'logged', 'to', 'stderr')
    logger.close(checkAndRestoreLogs(done, function() {
      log.info.args.should.eql(
        [['This', 'should', 'be', 'logged', 'to', 'stdout']])
      log.error.args.should.eql(
        [['This', 'should', 'be', 'logged', 'to', 'stderr']])
    }))
  })
})
