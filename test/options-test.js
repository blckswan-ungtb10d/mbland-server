'use strict'

var Options = require('../lib/options')
var path = require('path')
var chai = require('chai')

var expect = chai.expect
chai.should()

var config = require('../pages-config.json')

describe('Options', function() {
  it('should use top-level configuration defaults', function() {
    var hook = {
          repository: 'repo_name'
        },
        builderConfig = {
          'branch': 'mbland-pages',
          'repositoryDir': 'repo_dir',
          'generatedSiteDir': 'dest_dir'
        },
        opts = new Options(hook, config, builderConfig)

    expect(opts.repoDir).to.equal(path.join(config.home, 'repo_dir'))
    expect(opts.repoName).to.equal('repo_name')
    expect(opts.sitePath).to.equal(
      path.join(config.home, 'repo_dir', 'repo_name'))
    expect(opts.destDir).to.equal(path.join(config.home, 'dest_dir'))
    expect(opts.internalDestDir).to.be.undefined
    expect(opts.gitUrlPrefix).to.equal('git@github.com:mbland/')
    expect(opts.pagesConfig).to.equal('_config_pages.yml')
  })

  it('should override top-level defaults if builder-defined', function() {
    // Here we're also testing that we don't add an extra slash to gitUrlPrefix.
    var hook = {
          repository: 'repo_name'
        },
        builderConfig = {
          'gitUrlPrefix': 'git@github.com:foobar/',
          'pagesConfig': '_config_foobar_pages.yml',
          'pagesYaml': '.mbland-pages.yml',
          'branch': 'foobar-pages',
          'repositoryDir': 'repo_dir',
          'generatedSiteDir': 'dest_dir',
          'branchInUrlPattern': 'v[0-9]+.[0-9]+.[0-9]*[a-z]+'
        },
        opts = new Options(hook, config, builderConfig)

    expect(opts.repoDir).to.equal(path.join(config.home, 'repo_dir'))
    expect(opts.repoName).to.equal('repo_name')
    expect(opts.sitePath).to.equal(
      path.join(config.home, 'repo_dir', 'repo_name'))
    expect(opts.destDir).to.equal(path.join(config.home, 'dest_dir'))
    expect(opts.internalDestDir).to.be.undefined
    expect(opts.gitUrlPrefix).to.equal('git@github.com:foobar/')
    expect(opts.pagesConfig).to.equal('_config_foobar_pages.yml')
    expect(opts.pagesYaml).to.equal('.mbland-pages.yml')
    expect(opts.branchInUrlPattern.toString()).to.equal(
      '/' + builderConfig.branchInUrlPattern + '/i')
  })

  it('should set internalDestDir when internalSiteDir defined', function() {
    var hook = {
          repository: 'repo_name'
        },
        builderConfig = {
          'branch': 'mbland-pages',
          'repositoryDir': 'repo_dir',
          'generatedSiteDir': 'dest_dir',
          'internalSiteDir': 'internal_dest_dir'
        },
        opts = new Options(hook, config, builderConfig)

    expect(opts.destDir).to.equal(path.join(config.home, 'dest_dir'))
    expect(opts.internalDestDir).to.equal(
      path.join(config.home, 'internal_dest_dir'))
  })
})
