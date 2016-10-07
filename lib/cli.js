"use strict";
var get_node_versions_1 = require("./get-node-versions");
var Promise = require("bluebird");
function cli() {
    var userVersions = process.argv.splice(2);
    if (userVersions.length === 0) {
        process.stderr.write("Usage: " + process.argv[1] + " version [version ...]\n");
        process.exit(1);
    }
    Promise
        .resolve(userVersions)
        .then(get_node_versions_1.GetNodeVersions.parse)
        .map(function (realVersion) {
        process.stdout.write(realVersion + "\n");
    })
        .catch(function (error) {
        process.stderr.write(error.toString() + "\n");
        process.exit(2);
    });
}
module.exports = cli;
