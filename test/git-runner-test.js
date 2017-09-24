'use strict';

var GitRunner = require('../lib/git-runner');
var CommandRunner = require('../lib/command-runner');
var BuildLogger = require('../lib/build-logger');
var pagesConfig = require('../pages-config.json');
var path = require('path');
var fs = require('fs');
var sinon = require('sinon');
var chaiAsPromised = require('chai-as-promised');
var chai = require('chai');

chai.should();
chai.use(chaiAsPromised);

describe('GitRunner', function() {
  var config, opts, runner, commandRunner, logger,
      promise, sitePath, sitePathExists, startPromise;

  before(function() {
    config = JSON.parse(JSON.stringify(pagesConfig));
    config.git = 'git';
    opts = {
      githubOrg: 'mbland',
      repoDir: 'repo_dir',
      repoName: 'repo_name'
    };
    opts.sitePath = path.join('some/test/dir', opts.repoName);
    commandRunner = new CommandRunner(opts.sitePath, opts.repoName);
    logger = new BuildLogger();
  });

  beforeEach(function() {
    sinon.stub(fs, 'exists');
    sinon.stub(logger, 'log');
    sinon.stub(commandRunner, 'run');
    runner = new GitRunner(config, opts, commandRunner, logger);
  });

  afterEach(function() {
    commandRunner.run.restore();
    logger.log.restore();
    fs.exists.restore();
  });

  startPromise = function() {
    promise = runner.prepareRepo('mbland-pages');
    sitePath = fs.exists.args[0][0];
    sitePathExists = fs.exists.args[0][1];
  };

  it('should sync an existing repository', function() {
    commandRunner.run.resolves();
    startPromise();
    sitePath.should.eql(opts.sitePath);
    sitePathExists(true);

    return promise.should.be.fulfilled
      .then(function() {
        logger.log.args.should.eql([
          ['syncing repo:', opts.repoName]
        ]);
        commandRunner.run.args.should.eql([
          ['git', ['fetch', 'origin', 'mbland-pages']],
          ['git', ['clean', '-f']],
          ['git', ['reset', '--hard', 'origin/mbland-pages']],
          ['git', ['submodule', 'sync', '--recursive']],
          ['git', ['submodule', 'update', '--init', '--recursive']]
        ]);
      });
  });

  it('should clone the repository if none yet exists', function() {
    commandRunner.run.resolves();
    startPromise();
    sitePath.should.eql(opts.sitePath);
    sitePathExists(false);

    return promise.should.be.fulfilled
      .then(function() {
        logger.log.args.should.eql([
          [ 'cloning', 'repo_name', 'into',
            path.join('some/test/dir/repo_name')
          ]
        ]);
        commandRunner.run.args.should.eql([
          [ 'git',
            [ 'clone', 'git@github.com:mbland/repo_name.git',
              '--branch', 'mbland-pages'
            ],
            { cwd: opts.repoDir },
            'failed to clone'
          ]
        ]);
      });
  });

  it('should propagate an error if a sync fails', function() {
    commandRunner.run.withArgs('git', ['fetch', 'origin', 'mbland-pages'])
      .resolves();
    commandRunner.run.withArgs('git', ['clean', '-f'])
      .rejects(new Error('fail on git clean'));

    startPromise();
    sitePath.should.eql(opts.sitePath);
    sitePathExists(true);

    return promise.should.be.rejectedWith(Error, 'fail on git clean');
  });

  it('should propagate an error if a clone fails', function() {
    commandRunner.run.rejects(new Error('fail on git clone'));

    startPromise();
    sitePath.should.eql(opts.sitePath);
    sitePathExists(true);

    return promise.should.be.rejectedWith(Error, 'fail on git clone');
  });
});
