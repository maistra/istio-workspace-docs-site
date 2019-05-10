'use strict'

/**
 * Loosely based on https://github.com/couchbase/docs-site/blob/aa1f5e5a07027047eface38bc3ae34f0690a82d3/gulpfile.js
 */
const gulp = require('gulp');
const connect = require('gulp-connect');
const fs = require('fs');
const exitHook = require('exit-hook')
const yaml = require('js-yaml');
const commandLineArgs = require('command-line-args')
const generator = require('@antora/site-generator-default');

const optionDefinitions = [
  { name: 'source', alias: 's', type: String, defaultValue: 'site.yml' },
  { name: 'playbook', alias: 'p', type: String },
  { name: 'dir', alias: 'd', type: String, multiple: true },
  { name: 'output', alias: 'o', type: String, defaultValue: 'docs-dev' },
  { name: 'keep', alias: 'k', type: Boolean, defaultValue: false }
]

let [playbook, filename] = loadDevPlaybook()

let args = [
  "--playbook",
  filename
];

gulp.task('build', function (cb) {
  /**
   * Use the '@antora/site-generator-default' node module to build.
   * It's analogous to `$ antora --playbook site-dev.yml`.
   * Having access to the generator in code may be useful for other
   * reasons in the future (i.e to implement custom features).
   * NOTE: As opposed to building with the CLI, this method doesn't use
   * a separate process for each run. So if a build error occurs with the `gulp`
   * command it can be useful to check if it also happens with the CLI command.
   */
  generator(args, process.env)
    .then(() => {
      cb();
    })
    .catch(err => {
      console.log(err);
      cb();
    });
});

gulp.task('preview', ['build'], function () {
  /**
   * Remove the line gulp.src('README.adoc')
   * This is placeholder code to follow the gulp-connect
   * example. Could not make it work any other way.
   */
  gulp.src('README.adoc')
    .pipe(connect.reload());
})

gulp.task('watch', function () {
  let dirs = playbook.content.sources
    .map(source => [
      `${source.url}/**/**.yml`,
      `${source.url}/**/**.adoc`
    ]);
  dirs.push([filename]);
  gulp.watch(dirs, ['preview']);
});

gulp.task('connect', function() {
  let root = playbook.output.dir
  let title = playbook.site.title
  connect.server({
    port: 5353,
    name: `${title} Antora Doc Server`,
    livereload: true,
    root: root,
  });
});

gulp.task('default', ['connect', 'watch', 'build'])

// Uses playbook specified through p/playbook option or creates one on the fly
function loadDevPlaybook() {
  const options = commandLineArgs(optionDefinitions, { partial: true })
  var filename = options.playbook
  let playbook = yaml.safeLoad(fs.readFileSync(options.source, 'UTF-8'));

  if (!!!filename) {      
  
    if (!!!options.dir) {
      console.log('local clone of the repository is not specified, please clone it and point to it using -d or --dir flag')
      process.exit(-1);
    }
     
    filename = `${__dirname}/site-local-dev.yml`
    playbook.content.sources.forEach((e, i) => {
      e.url = options.dir[i % options.dir.length];
    });
    playbook.output.dir = options.output
    let yamlDoc = yaml.safeDump(playbook)
    fs.writeFileSync(filename, yamlDoc) 

    if (!options.keep) {    
      exitHook(() => {
        fs.unlinkSync(filename)
      })
    }
  
  }

  return [playbook, filename]
}