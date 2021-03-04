/**
 * Extends the AsciiDoc syntax by adding support for including the output of shell commands.
 *
 * This include directive executes given shell script and includes its output in the document.
 * The invoked command has to be in the $PATH.
 *
 * Usage:
 *
 *  include::cmd:ls[args='-al',block=true,print=true]
 * 
 *  - `args` will be added to command which is executes, e.g. include::cmd:ls[args='-al']. Can be combined with pipes
 *  - `flags` will be added to command which is executes, e.g. include::cmd:ls[flags='-al'] (DEPRECATED, use args instead)
 *  - `format` will define block format if specified (otherwise defaults to bash)
 *  - `block`, when set to true will wrap the output in [source,${format}] block
 *  - `print`, when set to true will add $ command before the output
 *  - `cwd` current working directory where the command is executed. Following variables can be used:
 *     - $PWD which is set to absolute path of the processed document 
 *     - $PROJECT_DIR which will take the processed document git root folder. 
 *     e.g.
 *
 * @author Aslak Knutsen <aslak@4fs.no>
 * @author Bartosz Majsak <bartosz.majsak@gmail.com>
 */

const spawnSync = require('child_process').spawnSync;
const { posix: path } = require('path');
const fs = require('fs');

const shellOptions = {
    shell: true,
    cwd: process.cwd(),
    env: {
        PATH: process.env.PATH
    }
};

function includeShellCommand({ file }) {
    return function() {
        const self = this;

        // This is important as it pushes this processor to be first handling include:: directive.
        // Without this, the default one would try to include this reference
        // resulting in failure: `Unresolved include directive in [...] - include:cmd://ls[args='-al']`
        self.$option('position', '>>');

        self.handles((target) => target.startsWith('cmd:'));

        self.process((doc, reader, target, attrs) => {
            const versionCmd = doc.getAttribute("versioned-command"); // defined in site.yml
            const version = doc.getAttribute("page-component-version") || 'latest';

            const cmd = target.substring(4);
            const args = attrs['args'] || attrs['flags'];
            const format = attrs['format'] || 'bash';
            let cwd = attrs['cwd'] || process.cwd();

            const orgCmd = cmd + ' ' + args;
            let command = orgCmd;
            if (cmd === versionCmd) {
                command = cmd + ' ' + version + ' ' + args;
            }

            let absolutePath = file.src.abspath;

            if (typeof absolutePath !== 'undefined') {
                absolutePath = path.resolve(absolutePath);
                let sourceDir = absolutePath;
                if (fs.lstatSync(absolutePath).isFile()) {
                    sourceDir = sourceDir.substring(0, sourceDir.lastIndexOf('/'));
                }
                cwd = cwd.replace("$PWD", sourceDir);
                if (cwd.includes("$PROJECT_DIR")) {
                    const gitRoot = spawnSync('git rev-parse --show-toplevel', {
                        shell: true,
                        cwd: sourceDir,
                        env: {
                            PATH: process.env.PATH
                        }
                    });
                    if (gitRoot.status == 0) {
                        cwd = cwd.replace("$PROJECT_DIR", gitRoot.stdout.toString().trimEnd());
                    } else {
                        console.log(gitRoot.stderr.toString());
                    }
                }
            }

            shellOptions.cwd = cwd;

            const result = spawnSync(command, shellOptions);
            let output = result.stdout.toString().trimEnd();
            if (result.status != 0) {
                output += "**" + result.stderr.toString().trimEnd() + "**";
            }

            if (!!attrs['block']) {
                output = `[source,${format}]
----
${!!attrs['print'] ? '$ ' + orgCmd : ''}
${output}
----`
            }

            reader.pushInclude(output, target, target, 1, attrs);
        })

    }
}

module.exports.register = function register(registry, context) {
  const filePath = context || {
      // To mimic context object being passed by Antora if we are using it through pure asciidoctor node cli 
      file: {
          src: {
              abspath: '.' 
          }
      }
  }; 
  if (typeof registry.register === 'function') {
      registry.register(function() {
          this.includeProcessor(includeShellCommand(filePath));
      });
  } else if (typeof registry.includeProcessor === 'function') {
      registry.includeProcessor(includeShellCommand(filePath));
  }
  return registry;
}
