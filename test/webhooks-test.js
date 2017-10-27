'use strict'

var webhooks = require('../lib/webhooks')
var SiteBuilder = require('../lib/site-builder')
var config = require('../pages-config.json')
var githubHook = require('./data/github-hook.json')
var bitbucketHook = require('./data/bitbucket-hook.json')
var parsedHook = require('./data/parsed-hook.json')
var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var sinon = require('sinon')

var expect = chai.expect
chai.should()
chai.use(chaiAsPromised)

describe('Webhooks', function() {
  var githubImpl = webhooks.createImpl('GitHub'),
      bitbucketImpl = webhooks.createImpl('Bitbucket'),
      cloneJson = json => JSON.parse(JSON.stringify(json))

  describe('parentFromGitUrlPrefix', function() {
    it('should get a git@github.org user or org', function() {
      webhooks.parentFromGitUrlPrefix('git@github.com:mbland/')
        .should.equal('mbland')
    })

    it('should get a https://github.org user or org', function() {
      webhooks.parentFromGitUrlPrefix('https://github.com/MBland/')
        .should.equal('mbland')
    })
  })

  describe('GitHub impl', function() {
    it('should parse a valid webhook', function() {
      githubImpl.parseHook(githubHook).should.eql(parsedHook)
    })

    it('should return null for an invalid webhook', function() {
      var hook = cloneJson(githubHook)
      delete hook.ref
      expect(githubImpl.parseHook(hook)).to.be.null
    })
  })

  describe('Bitbucket impl', function() {
    it('should parse a valid webhook', function() {
      var expectedHook = cloneJson(parsedHook)
      delete expectedHook.pusher
      bitbucketImpl.parseHook(bitbucketHook).should.eql(expectedHook)
    })

    it('should return null for an invalid webhook', function() {
      var hook = cloneJson(bitbucketHook)
      delete hook.refChanges
      expect(githubImpl.parseHook(hook)).to.be.null
    })

    it('should return null when the webhook isn\'t the last page', function() {
      var hook = cloneJson(bitbucketHook)
      hook.changesets.isLastPage = false
      expect(githubImpl.parseHook(hook)).to.be.null
    })
  })

  describe('createBuilder', function() {
    var builder,
        builderConfig,
        hook

    beforeEach(function() {
      builderConfig = { branch: 'pages' }
      hook = cloneJson(githubHook)
      sinon.stub(SiteBuilder, 'launchBuilder').returns(Promise.resolve())
    })

    afterEach(function() {
      SiteBuilder.launchBuilder.restore()
    })

    it('should match config.gitUrlPrefix, branch', function() {
      builder = webhooks.createBuilder(githubImpl, config, builderConfig)
      return builder(hook).then(function() {
        SiteBuilder.launchBuilder.called.should.be.true
        SiteBuilder.launchBuilder.args[0]
          .should.eql([hook, 'pages', builderConfig])
      })
    })

    it('should ignore hooks that don\'t match exactly', function() {
      // Note that matching the prefix isn't enough.
      hook.ref = 'refs/heads/pages-internal'
      builder = webhooks.createBuilder(githubImpl, config, builderConfig)
      return builder(hook).then(function() {
        SiteBuilder.launchBuilder.called.should.be.false
      })
    })

    it('should match builderConfig.gitUrlPrefix, branchInUrl', function() {
      builderConfig.gitUrlPrefix = 'git@github.com:msb'
      builderConfig.branchInUrlPattern = 'v[0-9]+\\.[0-9]+\\.[0-9]+'
      hook.repository.organization = 'msb'
      hook.ref = 'refs/heads/v3.6.9'
      builder = webhooks.createBuilder(githubImpl, config, builderConfig)

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
      return webhooks.handleWebhook({}, githubImpl, builders, send)
        .then(() => {
          send.calledWith(400).should.be.true
          builders[0].called.should.be.false
          builders[1].called.should.be.false
        })
    })

    it('should send 202 Accepted for a valid webhook and build OK', function() {
      return webhooks.handleWebhook(githubHook, githubImpl, builders, send)
        .then(() => {
          send.calledWith(202).should.be.true
          builders[0].called.should.be.true
          builders[1].called.should.be.true
        })
    })

    it('should send 202 Accepted but fail the build', function() {
      builders[1].returns(Promise.reject('build failure'))
      return webhooks.handleWebhook(githubHook, githubImpl, builders, send)
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

    it('should return a handler closure with acces to impl, builders', () => {
      var handler = webhooks.createHandler(config)

      return handler(githubHook, send).then(() => {
        send.calledWith(202).should.be.true
        SiteBuilder.launchBuilder.calledOnce.should.be.true
        SiteBuilder.launchBuilder.args[0]
          .should.eql([githubHook, 'pages', config.builders[0]])
      })
    })
  })
})
