'use strict'

var Options = require('../lib/options')
var path = require('path')
var chai = require('chai')

var expect = chai.expect
chai.should()

var OrigConfig = require('../pages-config.json')

describe('Options', function() {
  var config

  beforeEach(function() {
    config = JSON.parse(JSON.stringify(OrigConfig))
  })

  it('should use top-level configuration defaults', function() {
    var info = {
      repository: {
        name: 'repo_name'
      },
      ref: 'refs/heads/mbland-pages'
    }

    var builderConfig = {
      'branch': 'mbland-pages',
      'repositoryDir': 'repo_dir',
      'generatedSiteDir': 'dest_dir'
    }

    var opts = new Options(info, config, builderConfig)
    expect(opts.repoDir).to.equal(path.join(config.home, 'repo_dir'))
    expect(opts.repoName).to.equal('repo_name')
    expect(opts.sitePath).to.equal(
      path.join(config.home, 'repo_dir/repo_name'))
    expect(opts.destDir).to.equal(path.join(config.home, 'dest_dir'))
    expect(opts.internalDestDir).to.be.undefined
    expect(opts.gitUrlPrefix).to.equal('git@github.com:mbland/')
    expect(opts.pagesConfig).to.equal('_config_pages.yml')
  })

  it('should override top-level defaults if builder-defined', function() {
    var info = {
      repository: {
        name: 'repo_name'
      },
      ref: 'refs/heads/foobar-pages'
    }

    // Here we're also testing that we don't add an extra slash to gitUrlPrefix.
    var builderConfig = {
      'gitUrlPrefix': 'git@github.com:foobar/',
      'pagesConfig': '_config_foobar_pages.yml',
      'pagesYaml': '.mbland-pages.yml',
      'branch': 'foobar-pages',
      'repositoryDir': 'repo_dir',
      'generatedSiteDir': 'dest_dir',
      'branchInUrlPattern': 'v[0-9]+.[0-9]+.[0-9]*[a-z]+'
    }

    var opts = new Options(info, config, builderConfig)
    expect(opts.repoDir).to.equal(path.join(config.home, 'repo_dir'))
    expect(opts.repoName).to.equal('repo_name')
    expect(opts.sitePath).to.equal(
      path.join(config.home, 'repo_dir/repo_name'))
    expect(opts.destDir).to.equal(path.join(config.home, 'dest_dir'))
    expect(opts.internalDestDir).to.be.undefined
    expect(opts.gitUrlPrefix).to.equal('git@github.com:foobar/')
    expect(opts.pagesConfig).to.equal('_config_foobar_pages.yml')
    expect(opts.pagesYaml).to.equal('.mbland-pages.yml')
    expect(opts.branchInUrlPattern.toString()).to.equal(
      '/' + builderConfig.branchInUrlPattern + '/i')
  })

  it('should set internalDestDir when internalSiteDir defined', function() {
    var info = {
      repository: {
        name: 'repo_name'
      },
      ref: 'refs/heads/mbland-pages'
    }

    var builderConfig = {
      'branch': 'mbland-pages',
      'repositoryDir': 'repo_dir',
      'generatedSiteDir': 'dest_dir',
      'internalSiteDir': 'internal_dest_dir'
    }

    var opts = new Options(info, config, builderConfig)
    expect(opts.destDir).to.equal(path.join(config.home, 'dest_dir'))
    expect(opts.internalDestDir).to.equal(
      path.join(config.home, 'internal_dest_dir'))
  })
})
