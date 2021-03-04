const includeShellCommand = require('./include-shell.js')

function register(registry, context) {
    registry.includeProcessor(includeShellCommand(context));
}

module.exports.register = register;
