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
 *  - `cwd` current working directory where the command is executed. Using the expression $PROJECT_DIR will be replaced by the
 *        root folder of the git repo the current document is located in
 *     e.g.
 *          include::cmd:cat[args="awesomeness.go", cwd="$PROJECT_DIR/pkg/code"]

 *
 * @author Aslak Knutsen <aslak@4fs.no>
 * @author Bartosz Majsak <bartosz.majsak@gmail.com>
 */

const spawnSync = require('child_process').spawnSync;
const { posix: path } = require('path');
const fs = require('fs');

const shellOptions = {
    shell:  process.env.SHELL || '/bin/bash',
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

            const orgCmd = cmd + ' ' + args;
            let command = orgCmd;
            if (cmd === versionCmd) {
                command = cmd + ' ' + version + ' ' + args;
            }

            shellOptions.cwd = resolveCWD(file, attrs['cwd'] || process.cwd());

            const result = spawnSync(command, shellOptions);
            let output = "";
            if (result.status != 0) {
                output = "**" + result.stderr.toString() + "**";
            } else {
                output = result.stdout.toString();
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

function resolveCWD(file, cwd) {
  if (containPathExpressions(cwd)) {
      if (isPathBased(file)) {
          return resolveFromPath(file, cwd)
      } else {
          return resolveFromLocalClone(file, cwd)
      }
  }
  return cwd
}

function containPathExpressions(cwd) {
    return cwd.includes("$PROJECT_DIR")
}

function isPathBased(file) {
    return file.src.origin.worktree
}

function resolveFromPath(file, cwd) {
    absolutePath = path.resolve(file.src.abspath);
    let sourceDir = absolutePath;
    if (fs.lstatSync(absolutePath).isFile()) {
        sourceDir = sourceDir.substring(0, sourceDir.lastIndexOf(path.sep));
    }
    
    const gitRoot = spawnSync('git rev-parse --show-toplevel', {
        shell: true,
        cwd: sourceDir,
        env: {
            PATH: process.env.PATH
        }
    });
    if (gitRoot.status == 0) {
        return cwd.replace("$PROJECT_DIR", gitRoot.stdout.toString().trimEnd());
    } else {
        process.stderr.write(gitRoot.stderr.toString());
    }
    return cwd
}

function resolveFromLocalClone(file, cwd) {
    const origin = file.src.origin;
    const component = file.src.component;
    const branch = origin.branch || origin.tag
    var cmd = 'git clone ' + origin.url + ' --depth 1 --branch ' + branch + ' --single-branch '
    const repoFolder = `${path.sep}tmp${path.sep}${component}-${branch}`;
    cmd = `${cmd} ${repoFolder}`;
    if (!fs.existsSync(repoFolder)) {
        const clone = spawnSync(cmd, {
            shell: true,
            cwd: process.cwd(),
            env: {
                PATH: process.env.PATH
            }
        });

        if (clone.status != 0) {
            process.stderr.write(clone.stderr.toString()); 
        }

    }
    return cwd.replace("$PROJECT_DIR",  repoFolder);
}

module.exports.register = function register(registry, context) {
  const filePath = context || {
      // To mimic context object being passed by Antora if we are using it through pure asciidoctor node cli 
      file: {
          src: {
              abspath: '.',
              origin: {
                worktree: true
              }
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
