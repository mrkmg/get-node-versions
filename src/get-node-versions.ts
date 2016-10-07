import * as Promise from "bluebird";
import flatten = require("flatten");
import {ClientResponse} from "http";
import * as Semver from "semver";
import * as SemverLoose from "semver-loose";

export class GetNodeVersions {
    public static NODEJS_MIRROR: string = "https://nodejs.org/dist/";
    public static versionListCache: Array<VersionListCacheItem>;

    public static parse(versions: string | Array<string>): Promise<Array<string>> {
        if (Array.isArray(versions)) {
            return (new GetNodeVersions()).parseArray(<Array<string>> versions);
        } else if (typeof versions === "string" || versions instanceof String) {
            return (new GetNodeVersions()).parseString(versions);
        } else {
            return Promise.reject("versions must be a string or an array");
        }
    }

    private static extractVersion(version: VersionListCacheItem) {
        return Semver.clean(version.version);
    }

    private static trim(input: any): string {
        return input.toString().trim();
    }

    private static isLegacy(version: string) {
        return Semver.major(version) === 0;
    }

    private static isNotLegacy(version: string) {
        return !GetNodeVersions.isLegacy(version);
    }

    private static makeVersion(str: string): UnresolvedVersion {
        let [version, ...filters] = str.split("|").map(GetNodeVersions.trim);
        return {
            filters,
            version,
        };
    }

    private static isPartialVersion(str: string): boolean {
        return /^(\d+)(\.)?(\d+)?(\.)?(\d+)?$/.test(str);
    }

    private static dedupArray(array: Array<any>): Array<any> {
        return array.filter((i, p, s) => {
            return s.indexOf(i) === p;
        });
    }

    private static removeInvalid(array: Array<string>): Array<string> {
        return array.filter((version) => {
            return version !== "0.0.0";
        });
    }

    private processFilter(version: UnresolvedVersion): Promise<boolean> {
        return Promise
            .resolve(version.filters)
            .reduce((lastResult: boolean, filter: string) => {
                return Promise.try(() => {
                    return this.filterVersion(version.version, filter);
                }).then((result: boolean) => {
                    return result && lastResult;
                });
            }, true);
    }

    private parseString(versions: string): Promise<Array<string>> {
        return Promise
            .resolve(versions)
            .then(GetNodeVersions.makeVersion)
            .then(this.resolveKeyword.bind(this))
            .map(this.resolveVersion.bind(this))
            .filter(this.processFilter.bind(this))
            .map((version: UnresolvedVersion) => {
                return version.version;
            })
            .then((allVersions: Array<string>) => {
                return allVersions.sort(Semver.compare);
            });
    }

    private parseArray(versions: Array<string>): Promise<Array<string>> {
        return Promise
            .resolve(versions)
            .map(this.parseString.bind(this))
            .then(flatten)
            .then(GetNodeVersions.dedupArray)
            .then(GetNodeVersions.removeInvalid)
            .then((allVersions: Array<string>) => {
                return allVersions.sort(Semver.compare);
            });
    }

    private resolveKeyword(version: UnresolvedVersion): Promise<Array<UnresolvedVersion>> {
        return Promise
            .try(() => {
                switch (version.version) {
                    case "major":
                        return this.major();
                    case "minor":
                        return this.minor();
                    case "patch":
                        return this.patch();
                    case "legacy":
                        return this.legacy();
                    case "all":
                        return this.all();
                    default:
                        if (GetNodeVersions.isPartialVersion(version.version)) {
                            return Promise.resolve([version.version]);
                        } else {
                            return Promise.reject(new Error(`Unknown keyword or version: ${version.version}`));
                        }
                }
            })
            .map((resolvedVersion: string) => {
                return {
                    filters: version.filters,
                    version: resolvedVersion,
                };
            });

    }

    private resolveVersion(version: UnresolvedVersion): Promise<UnresolvedVersion> {
        return Promise
            .try(this.getVersionList.bind(this))
            .map(GetNodeVersions.extractVersion)
            .reduce((bestVersion: string, testVersion: string) => {
                return SemverLoose.match(version.version, testVersion) && Semver.gt(testVersion, bestVersion)
                    ? testVersion
                    : bestVersion;
            }, "0.0.0")
            .then((resolvedVersion: string) => {
                return {
                    filters: version.filters,
                    version: resolvedVersion,
                };
            });
    }

    private filterVersion(version: string, filterString: string) {
        let [type, test] = filterString.split(":").map(GetNodeVersions.trim);

        switch (type) {
            case "gt":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveGreatestVersion)
                    .then((t) => {
                        return Semver.gt(version, t);
                    });
            case "gte":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveLeastVersion)
                    .then((t) => {
                        return Semver.gte(version, t);
                    });
            case "lt":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveLeastVersion)
                    .then((t) => {
                        return Semver.lt(version, t);
                    });
            case "lte":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveGreatestVersion)
                    .then((t) => {
                        return Semver.lte(version, t);
                    });
            case "eq":
                return Promise.resolve(SemverLoose.match(test, version));
            case "neq":
                return Promise.resolve(!SemverLoose.match(test, version));
            case "lts":
                return Promise.bind(this).return(version).then(this.isLts);
            default:
                throw new Error("Unknown filter type: " + type);
        }
    }

    private resolveGreatestVersion(version: string) {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .reduce((bestVersion: string, testVersion: string) => {
                return SemverLoose.match(version, testVersion) && Semver.gt(testVersion, bestVersion)
                    ? testVersion
                    : bestVersion;
            }, "0.0.0");
    }

    private resolveLeastVersion(version: string) {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .reduce((bestVersion: string, testVersion: string) => {
                return SemverLoose.match(version, testVersion) && Semver.lt(testVersion, bestVersion)
                    ? testVersion
                    : bestVersion;
            }, "9999999.9999999.9999999");
    }

    private major(): Promise<Array<string>> {
        return Promise
            .bind(this)
            .then(this.notLegacy)
            .then((remoteVersions: Array<string>) => {
                let versions: Array<string> = [];
                remoteVersions.forEach((version: string) => {
                    let majorVersion = `${Semver.major(version)}.x`;
                    if (versions.indexOf(majorVersion) === -1) {
                        versions.push(majorVersion);
                    }
                });

                return versions;
            });
    }

    private minor(): Promise<Array<string>> {
        return Promise
            .bind(this)
            .then(this.notLegacy)
            .then((remoteVersions: Array<string>) => {
                let versions: Array<string> = [];
                remoteVersions.forEach((version: string) => {
                    let minorVersion = `${Semver.major(version)}.${Semver.minor(version)}.x`;
                    if (versions.indexOf(minorVersion) === -1) {
                        versions.push(minorVersion);
                    }
                });

                return versions;
            });
    }

    private patch(): Promise<Array<string>> {
        return Promise
            .bind(this)
            .then(this.notLegacy)
            .then((remoteVersions: Array<string>) => {
                let versions: Array<string> = [];
                remoteVersions.forEach((version: string) => {
                    let patchVersion = `${Semver.major(version)}.${Semver.minor(version)}.${Semver.patch(version)}`;
                    if (versions.indexOf(patchVersion) === -1) {
                        versions.push(patchVersion);
                    }
                });

                return versions;
            });
    }

    private legacy(): Promise<Array<string>> {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .filter(GetNodeVersions.isLegacy);
    }

    private notLegacy(): Promise<Array<string>> {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .filter(GetNodeVersions.isNotLegacy);
    }

    private all(): Promise<Array<string>> {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion);
    }

    private isLts(version: string): Promise<boolean> {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .reduce((passed: boolean, remoteVersion: VersionListCacheItem) => {
                return passed || (Semver.eq(version, remoteVersion.version) && !!remoteVersion.lts);
            }, false);
    }

    private getVersionList() {
        if (GetNodeVersions.versionListCache) {
            return Promise.resolve(GetNodeVersions.versionListCache);
        } else {
            return new Promise(((resolve, reject) => {
                let lib = GetNodeVersions.NODEJS_MIRROR.substr(0, 5) === "https" ? require("https") : require("http");
                let request = lib.get(GetNodeVersions.NODEJS_MIRROR + "/index.json", (response: ClientResponse) => {
                    if (response.statusCode < 200 || response.statusCode > 299) {
                        let errorStr = `Failed to load nodejs version list from: ${GetNodeVersions.NODEJS_MIRROR}`;
                        return reject(new Error(errorStr));
                    }

                    let body: Array<string> = [];

                    response.on("data", (data: Blob) => {
                        body.push(data.toString());
                    });
                    response.on("end", () => {
                        try {
                            GetNodeVersions.versionListCache = JSON.parse(body.join(""));
                        } catch (e) {
                            reject(e);
                        }
                        resolve(GetNodeVersions.versionListCache);
                    });
                });

                request.on("error", reject);
            }));
        }
    }
}

class UnresolvedVersion {
    public filters: Array<string>;
    public version: string;
}

export class VersionListCacheItem {
    public version: string;
    public date: string;
    public files: Array<string>;
    public npm: string;
    public v8: string;
    public uv: string;
    public zlib: string;
    public openssl: string;
    public modules: string;
    public lts: boolean;
}
