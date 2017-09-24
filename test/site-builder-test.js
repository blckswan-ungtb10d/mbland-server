'use strict';

var SiteBuilder = require('../lib/site-builder');
var Options = require('../lib/options');
var BuildLogger = require('../lib/build-logger');
var ComponentFactory = require('../lib/component-factory');
var fs = require('fs');
var path = require('path');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var childProcess = require('child_process');
var mockSpawn = require('mock-spawn');

var FilesHelper = require('./files-helper');
var OrigConfig = require('../pages-config.json');

var expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('SiteBuilder', function() {
  var config, origSpawn, mySpawn, logger, logMsgs, errMsgs, expectLogMessages;

  function cloneConfig() {
    config = JSON.parse(JSON.stringify(OrigConfig));
    config.git = 'git';
    config.bundler = 'bundle';
    config.bundlerCacheDir = 'bundler_cache_dir';
    config.jekyll = 'jekyll';
    config.rsync = 'rsync';
  }

  before(function() {
    cloneConfig();
    SiteBuilder.setConfiguration(config);
  });

  beforeEach(function() {
    origSpawn = childProcess.spawn;
    mySpawn = mockSpawn();
    childProcess.spawn = mySpawn;
    logger = new BuildLogger();
  });

  afterEach(function() {
    childProcess.spawn = origSpawn;
  });

  var makeOpts = function() {
    var info = {
      repository: {
        name: 'repo_name'
      },
      ref: 'refs/heads/mbland-pages'
    };

    var builderConfig = {
      'branch': 'mbland-pages',
      'repositoryDir': 'repo_dir',
      'generatedSiteDir': 'dest_dir'
    };
    return new Options(info, config, builderConfig);
  };

  var makeBuilder = function(options, branch) {
    var opts = options || makeOpts(),
        targetBranch = branch || 'mbland-pages',
        components;

    components = new ComponentFactory(config, opts, targetBranch, logger);
    return new SiteBuilder(targetBranch, components);
  };

  expectLogMessages = function(consoleArgs, expected) {
    var consoleMessages = consoleArgs.map(function(arg) {
      return arg.join(' ');
    });
    expect(consoleMessages).to.eql(expected);
  };

  describe('build', function() {
    var builder, buildConfigs;

    beforeEach(function() {
      builder = makeBuilder();
      buildConfigs = [{
        destination: path.join(config.home, 'dest_dir/repo_name'),
        configurations: '_config.yml,' + config.pagesConfig
      }];

      sinon.stub(builder.gitRunner, 'prepareRepo').resolves();
      sinon.stub(builder.configHandler, 'init').resolves();
      sinon.stub(builder.commandRunner, 'run').resolves();
      sinon.stub(builder.configHandler, 'readOrWriteConfig').resolves();
      sinon.stub(builder.configHandler, 'buildConfigurations')
        .returns(buildConfigs);
      sinon.stub(builder.jekyllHelper, 'build').resolves();
      sinon.stub(builder.configHandler, 'removeGeneratedConfig').resolves();
      sinon.stub(builder.sync, 'sync').resolves();
      sinon.stub(builder.updateLock, 'doLockedOperation')
        .callsFake(function(doBuild) {
          return doBuild();
        });
    });

    it('should perform a successful jekyll build without bundler', function() {
      builder.configHandler.usesJekyll = true;
      builder.configHandler.usesBundler = false;

      return builder.build().should.be.fulfilled
        .then(function() {
          builder.gitRunner.prepareRepo.args.should.eql([[builder.branch]]);
          builder.configHandler.init.called.should.be.true;
          builder.commandRunner.run.called.should.be.false;
          builder.configHandler.readOrWriteConfig.called.should.be.true;
          builder.jekyllHelper.build.args.should.eql([
            [buildConfigs, { bundler: false }]
          ]);
          builder.sync.sync.args.should.eql([
            [path.join(config.home, 'dest_dir/repo_name')]
          ]);
          builder.configHandler.removeGeneratedConfig.called.should.be.true;
        });
    });

    it('should perform a successful jekyll build using bundler', function() {
      builder.configHandler.usesJekyll = true;
      builder.configHandler.usesBundler = true;

      return builder.build().should.be.fulfilled
        .then(function() {
          builder.gitRunner.prepareRepo.args.should.eql([[builder.branch]]);
          builder.configHandler.init.called.should.be.true;
          builder.commandRunner.run.args.should.eql([
            [config.bundler,
             ['install',
              '--path=' + path.join(config.home, config.bundlerCacheDir)]]
          ]);
          builder.configHandler.readOrWriteConfig.called.should.be.true;
          builder.jekyllHelper.build.args.should.eql([
            [buildConfigs, { bundler: true }]
          ]);
          builder.sync.sync.args.should.eql([
            [path.join(config.home, 'dest_dir/repo_name')]
          ]);
          builder.configHandler.removeGeneratedConfig.called.should.be.true;
        });
    });

    it('should perform a successful rsync build', function() {
      var buildDestination = path.join(config.home, 'dest_dir/repo_name');

      builder.configHandler.usesJekyll = false;
      builder.configHandler.usesBundler = false;

      return builder.build().should.be.fulfilled
        .then(function() {
          builder.gitRunner.prepareRepo.args.should.eql([[builder.branch]]);
          builder.configHandler.init.called.should.be.true;
          builder.commandRunner.run.args.should.eql([
            [config.rsync, config.rsyncOpts.concat(['./', buildDestination])]
          ]);
          builder.sync.sync.args.should.eql([[buildDestination]]);
          builder.configHandler.readOrWriteConfig.called.should.be.false;
          builder.jekyllHelper.build.called.should.be.false;
          builder.configHandler.removeGeneratedConfig.called.should.be.false;
        });
    });

    it('should propagate errors from a failed build', function() {
      builder.gitRunner.prepareRepo.withArgs(builder.branch)
        .rejects(new Error('test error'));

      return builder.build().should.be.rejectedWith(Error, 'test error')
        .then(function() {
          builder.configHandler.init.called.should.be.false;
          builder.commandRunner.run.called.should.be.false;
          builder.configHandler.readOrWriteConfig.called.should.be.false;
          builder.jekyllHelper.build.called.should.be.false;
          builder.sync.sync.called.should.be.false;
          builder.configHandler.removeGeneratedConfig.called.should.be.false;
        });
    });
  });

  describe('makeBuilderListener and launchBuilder', function() {
    var webhook, incomingPayload, builderConfig, cloneDir, outputDir, buildLog,
        filesHelper;

    before(function() {
      incomingPayload = {
        'ref': 'refs/heads/mbland-pages',
        'repository': {
          'name': 'foo',
          'full_name': 'mbland/foo',
          'organization': 'mbland'
        },
        'head_commit': {
          'id': 'deadbeef',
          'message': 'Build me',
          'timestamp': '2015-09-25',
          'committer': { 'email': 'mbland@acm.org' }
        },
        'pusher': { 'name': 'Mike Bland', 'email': 'mbland@acm.org' },
        'sender': { 'login': 'mbland' }
      };

      builderConfig = {
        'branch': 'mbland-pages',
        'repositoryDir': 'repo_dir',
        'generatedSiteDir': 'dest_dir'
      };

      cloneDir = path.join('repo_dir/foo');
      outputDir = path.join('dest_dir/foo');
      buildLog = path.join(outputDir, 'build.log');

      filesHelper = new FilesHelper();
      return filesHelper.init(config)
        .then(function() {
          config.home = filesHelper.tempDir;
        });
    });

    after(function() {
      return filesHelper.after();
    });

    beforeEach(function() {
      webhook = { on: sinon.spy() };
      filesHelper.files.push(buildLog);

      // Note that the site builder will not create the parent directory for
      // the generated sites. That should be done before launching the server.
      return filesHelper.createDir('repo_dir')
        .then(function() {
          return filesHelper.createDir('dest_dir');
        })
        .then(function() {
          return filesHelper.createDir(path.join('dest_dir', 'foo'));
        });
    });

    afterEach(function() {
      return filesHelper.afterEach();
    });

    var captureLogs = function() {
      sinon.stub(console, 'log');
      sinon.stub(console, 'error');
    };

    var restoreLogs = function(err) {
      return new Promise(function(resolve, reject) {
        logMsgs = console.log.args;
        errMsgs = console.error.args;
        console.error.restore();
        console.log.restore();
        err ? reject(err) : resolve();
      });
    };

    it('should create a function to launch a builder', function() {
      var handler = SiteBuilder.makeBuilderListener(webhook, builderConfig);
      expect(handler).to.be.a.Function;
      expect(webhook.on.calledTwice).to.be.true;
      expect(webhook.on.args[0].length).to.equal(2);
      expect(webhook.on.args[0][0]).to.equal('create');
      expect(webhook.on.args[0][1]).to.be.handler;
      expect(webhook.on.args[1].length).to.equal(2);
      expect(webhook.on.args[1][0]).to.equal('push');
      expect(webhook.on.args[1][1]).to.be.handler;
    });

    it('should match the branch exactly, not just a prefix', function() {
      var handler = SiteBuilder.makeBuilderListener(webhook, builderConfig),
          payload = JSON.parse(JSON.stringify(incomingPayload));

      payload.ref = 'refs/heads/mbland-pages-internal';
      captureLogs();
      return handler(payload)
        .then(restoreLogs, restoreLogs)
        .should.be.fulfilled
        .then(function() {
          expect(logMsgs).to.be.empty;
          expect(errMsgs).to.be.empty;
        });
    });

    it('should create a builder that builds the site', function() {
      var handler = SiteBuilder.makeBuilderListener(webhook, builderConfig);

      mySpawn.setDefault(mySpawn.simple(0));
      captureLogs();
      return handler(incomingPayload)
        .then(restoreLogs, restoreLogs)
        .should.be.fulfilled
        .then(function() {
          var expectedMessages = [
                'mbland/foo: starting build at commit deadbeef',
                'description: Build me',
                'timestamp: 2015-09-25',
                'committer: mbland@acm.org',
                'pusher: Mike Bland mbland@acm.org',
                'sender: mbland',
                'cloning foo into ' + path.join(config.home, cloneDir),
                'syncing to ' + config.s3.bucket + '/' +
                  outputDir.replace(/\\/g, '/'),
                'foo: build successful'
              ],
              expectedLog = expectedMessages.join('\n') + '\n';

          expectLogMessages(logMsgs, expectedMessages);
          expect(errMsgs).to.be.empty;
          expect(fs.readFileSync(path.join(config.home, buildLog), 'utf8'))
            .to.equal(expectedLog);
        });
    });

    it('should create a builder that fails to build the site', function() {
      var handler = SiteBuilder.makeBuilderListener(webhook, builderConfig),
          errMsg = 'failed to clone foo ' +
            'with exit code 1 from command: ' +
            'git clone git@github.com:mbland/foo.git --branch mbland-pages';

      mySpawn.setDefault(mySpawn.simple(1));
      captureLogs();
      return handler(incomingPayload)
        .then(restoreLogs, restoreLogs)
        .should.be.rejectedWith(errMsg)
        .then(function() {
          var expectedMessages = [
                'mbland/foo: starting build at commit deadbeef',
                'description: Build me',
                'timestamp: 2015-09-25',
                'committer: mbland@acm.org',
                'pusher: Mike Bland mbland@acm.org',
                'sender: mbland',
                'cloning foo into ' + path.join(config.home, cloneDir)
              ],
              expectedErrors = [errMsg, 'foo: build failed'],
              expectedLog = expectedMessages.concat(expectedErrors)
                .join('\n') + '\n';

          expectLogMessages(logMsgs, expectedMessages);
          expectLogMessages(errMsgs, expectedErrors);
          expect(fs.readFileSync(path.join(config.home, buildLog), 'utf8'))
            .to.equal(expectedLog);
        });
    });

    it('should ignore payloads from other organizations', function() {
      var handler = SiteBuilder.makeBuilderListener(webhook, builderConfig);
      incomingPayload.repository.organization = 'notmbland';
      captureLogs();

      return handler(incomingPayload)
        .then(restoreLogs, restoreLogs)
        .should.be.fulfilled
        .then(function() {
          expect(logMsgs).to.be.empty;
          expect(errMsgs).to.be.empty;
        });
    });
  });
});
