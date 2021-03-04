const includeShellCommand = require('./include-shell.js')

module.exports.register = function register(registry) {
    const filePath = {
        file: {
            src: {
                abspath: '.' // To mimic context object being passed by Antora
            }
        }
    }; 
    if (typeof registry.register === 'function') {
        registry.register(function() {
            this.includeProcessor(includeShellCommand(filePath));
        })
    } else if (typeof registry.includeProcessor === 'function') {
        registry.includeProcessor(includeShellCommand(filePath))
    }
    return registry
}
