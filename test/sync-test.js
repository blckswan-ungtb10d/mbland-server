'use strict'

var Sync = require('../lib/sync')
var origConfig = require('../pages-config.json')
var EventEmitter = require('events')
var path = require('path')
var sinon = require('sinon')
var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var expect = chai.expect

chai.should()
chai.use(chaiAsPromised)

describe('Sync', function() {
  var sync,
      config,
      fakeLogger = {},
      uploader,
      s3client,
      buildDestination = path.join(origConfig.home, 'dest_dir/repo_name')

  beforeEach(function() {
    config = JSON.parse(JSON.stringify(origConfig))
    config.s3 = {
      bucket: 'mbland-pages'
    }
    fakeLogger.log = sinon.stub()
    uploader = new EventEmitter
    s3client = {
      uploadDir: sinon.stub().returns(uploader)
    }
    sync = new Sync(config, s3client, fakeLogger)
  })

  it('should throw if the build destination is invalid', function() {
    expect(function() { sync.sync('/foo') })
      .to.throw('invalid build destination /foo; ' +
        'should be a subdirectory of ' + config.home)
    fakeLogger.log.called.should.be.false
    s3client.uploadDir.called.should.be.false
  })

  it('should skip the sync if not configured', function() {
    delete sync.s3
    return sync.sync(buildDestination).should.be.fulfilled.then(function() {
      fakeLogger.log.called.should.be.false
      s3client.uploadDir.called.should.be.false
    })
  })

  it('should sync the build destination to s3', function() {
    var syncOp = sync.sync(buildDestination)

    uploader.emit('end').should.be.true
    return syncOp.should.be.fulfilled.then(function() {
      s3client.uploadDir.calledOnce.should.be.true
      s3client.uploadDir.args[0].should.eql([
        {
          localDir: buildDestination,
          deleteRemoved: true,
          s3Params: {
            Bucket: 'mbland-pages',
            Prefix: 'dest_dir/repo_name'
          }
        }
      ])
      fakeLogger.log.args.should.eql([
        ['syncing to', 's3://mbland-pages/dest_dir/repo_name']
      ])
    })
  })

  it('should report an error if the s3 sync fails', function() {
    var syncOp = sync.sync(buildDestination)

    uploader.emit('error', new Error('test failure')).should.be.true
    return syncOp.should.be.rejectedWith(Error,
      'Error: s3 sync failed for s3://mbland-pages/dest_dir/repo_name: ' +
      'Error: test failure')
  })
})
