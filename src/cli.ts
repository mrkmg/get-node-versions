import {GetNodeVersions} from "./get-node-versions";
import * as Promise from "bluebird";

function cli() {
    let userVersions = process.argv.splice(2);

    if (userVersions.length === 0) {
        process.stderr.write(`Usage: ${process.argv[1]} version [version ...]\n`);
        process.exit(1);
    }

    Promise
        .resolve(userVersions)
        .then(GetNodeVersions.parse)
        .map((realVersion: string) => {
            process.stdout.write(`${realVersion}\n`);
        })
        .catch((error: any) => {
            process.stderr.write(`${error.toString()}\n`);
            process.exit(2);
        });
}

export = cli;
