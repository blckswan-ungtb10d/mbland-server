'use strict'

var webhooks = require('../lib/webhooks')
var SiteBuilder = require('../lib/site-builder')
var config = require('../pages-config.json')
var githubHook = require('./webhooks/github.json')
var bitbucketHook = require('./webhooks/bitbucket.json')
var parsedHook = require('./webhooks/parsed.json')
var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var sinon = require('sinon')

var expect = chai.expect
chai.should()
chai.use(chaiAsPromised)

describe('Webhooks', function() {
  var githubParser = webhooks.getParser('GitHub'),
      bitbucketParser = webhooks.getParser('Bitbucket'),
      cloneJson = json => JSON.parse(JSON.stringify(json))

  describe('collectionFromGitUrlPrefix', function() {
    it('should get a git@github.org user or org', function() {
      webhooks.collectionFromGitUrlPrefix('git@github.com:mbland/')
        .should.equal('mbland')
    })

    it('should get a https://github.org user or org', function() {
      webhooks.collectionFromGitUrlPrefix('https://github.com/MBland/')
        .should.equal('mbland')
    })
  })

  describe('getParser', function() {
    it('should raise an error if the webhookType is unknown', function() {
      try {
        webhooks.getParser('foobar')
        throw new Error('Didn\'t raise an error when it should\'ve')
      } catch (err) {
        err.message.should.eql('Unknown webhookType: foobar')
      }
    })
  })

  describe('GitHub parser', function() {
    it('should parse a valid webhook', function() {
      githubParser(githubHook).should.eql(parsedHook)
    })

    it('should return null for an invalid webhook', function() {
      var hook = cloneJson(githubHook)
      delete hook.ref
      expect(githubParser(hook)).to.be.null
    })
  })

  describe('Bitbucket parser', function() {
    it('should parse a valid webhook', function() {
      var expectedHook = cloneJson(parsedHook)
      delete expectedHook.committer
      delete expectedHook.pusher
      bitbucketParser(bitbucketHook).should.deep.eql(expectedHook)
    })

    it('should return null for an invalid webhook', function() {
      var hook = cloneJson(bitbucketHook)
      delete hook.refChanges
      expect(bitbucketParser(hook)).to.be.null
    })

    it('should return null when the webhook isn\'t the last page', function() {
      var hook = cloneJson(bitbucketHook)
      hook.changesets.isLastPage = false
      expect(bitbucketParser(hook)).to.be.null
    })
  })

  describe('createBuilder', function() {
    var builder,
        builderConfig,
        hook

    beforeEach(function() {
      builderConfig = { branch: 'pages' }
      hook = cloneJson(parsedHook)
      sinon.stub(SiteBuilder, 'launchBuilder').returns(Promise.resolve())
    })

    afterEach(function() {
      SiteBuilder.launchBuilder.restore()
    })

    it('should match config.gitUrlPrefix, branch', function() {
      builder = webhooks.createBuilder(config, builderConfig)
      return builder(hook).then(function() {
        SiteBuilder.launchBuilder.called.should.be.true
        SiteBuilder.launchBuilder.args[0]
          .should.eql([hook, 'pages', builderConfig])
      })
    })

    it('should ignore hooks that don\'t match exactly', function() {
      // Note that matching the prefix isn't enough.
      hook.branch = 'refs/heads/pages-internal'
      builder = webhooks.createBuilder(config, builderConfig)
      return builder(hook).then(function() {
        SiteBuilder.launchBuilder.called.should.be.false
      })
    })

    it('should match builderConfig.gitUrlPrefix, branchInUrl', function() {
      builderConfig.gitUrlPrefix = 'git@github.com:msb'
      builderConfig.branchInUrlPattern = 'v[0-9]+\\.[0-9]+\\.[0-9]+'
      hook.collection = 'msb'
      hook.branch = 'refs/heads/v3.6.9'
      builder = webhooks.createBuilder(config, builderConfig)

      return builder(hook).then(function() {
        SiteBuilder.launchBuilder.called.should.be.true
        SiteBuilder.launchBuilder.args[0]
          .should.eql([hook, 'v3.6.9', builderConfig])
      })
    })
  })

  describe('handleWebhook', function() {
    var builders,
        send

    beforeEach(function() {
      builders = [sinon.stub(), sinon.stub()]
      builders.forEach(builder => builder.returns(Promise.resolve()))
      send = sinon.spy()
    })

    it('should send 400 Bad Request for an invalid webhook', function() {
      return webhooks.handleWebhook({foo: 'bar'}, githubParser, builders, send)
        .should.be.fulfilled
        .then(() => {
          send.calledWith(400).should.be.true
          builders[0].called.should.be.false
          builders[1].called.should.be.false
        })
    })

    it('should send 400 Bad Request if a parse error occurs', function() {
      var badHook = JSON.parse(JSON.stringify(githubHook))

      badHook.head_commit = {}  // eslint-disable-line camelcase
      return webhooks.handleWebhook(badHook, githubParser, builders, send)
        .should.be.fulfilled
        .then(() => {
          send.calledWith(400).should.be.true
          builders[0].called.should.be.false
          builders[1].called.should.be.false
        })
    })

    it('should send 202 Accepted for a valid webhook and build OK', function() {
      return webhooks.handleWebhook(githubHook, githubParser, builders, send)
        .should.be.fulfilled
        .then(() => {
          send.calledWith(202).should.be.true
          builders[0].called.should.be.true
          builders[1].called.should.be.true
        })
    })

    it('should send 202 Accepted but fail the build', function() {
      builders[1].returns(Promise.reject('build failure'))
      return webhooks.handleWebhook(githubHook, githubParser, builders, send)
        .should.be.rejectedWith('build failure')
        .then(() => {
          send.calledWith(202).should.be.true
          builders[0].called.should.be.true
          builders[1].called.should.be.true
        })
    })
  })

  describe('createHandler', function() {
    var send

    beforeEach(function() {
      sinon.stub(SiteBuilder, 'launchBuilder').returns(Promise.resolve())
      send = sinon.spy()
    })

    afterEach(function() {
      SiteBuilder.launchBuilder.restore()
    })

    it('should return a handler with access to parser, builders', () => {
      var handler = webhooks.createHandler(config)

      return handler(githubHook, send).then(() => {
        send.calledWith(202).should.be.true
        SiteBuilder.launchBuilder.calledOnce.should.be.true
        SiteBuilder.launchBuilder.args[0]
          .should.eql([parsedHook, 'pages', config.builders[0]])
      })
    })
  })
})
