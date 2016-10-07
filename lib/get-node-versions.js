"use strict";
var Promise = require("bluebird");
var flatten = require("flatten");
var Semver = require("semver");
var SemverLoose = require("semver-loose");
var GetNodeVersions = (function () {
    function GetNodeVersions() {
    }
    GetNodeVersions.parse = function (versions) {
        if (Array.isArray(versions)) {
            return (new GetNodeVersions()).parseArray(versions);
        }
        else if (typeof versions === "string" || versions instanceof String) {
            return (new GetNodeVersions()).parseString(versions);
        }
        else {
            return Promise.reject("versions must be a string or an array");
        }
    };
    GetNodeVersions.extractVersion = function (version) {
        return Semver.clean(version.version);
    };
    GetNodeVersions.trim = function (input) {
        return input.toString().trim();
    };
    GetNodeVersions.isLegacy = function (version) {
        return Semver.major(version) === 0;
    };
    GetNodeVersions.isNotLegacy = function (version) {
        return !GetNodeVersions.isLegacy(version);
    };
    GetNodeVersions.makeVersion = function (str) {
        var _a = str.split("|").map(GetNodeVersions.trim), version = _a[0], filters = _a.slice(1);
        return {
            filters: filters,
            version: version
        };
    };
    GetNodeVersions.isPartialVersion = function (str) {
        return /^(\d+)(\.)?(\d+)?(\.)?(\d+)?$/.test(str);
    };
    GetNodeVersions.dedupArray = function (array) {
        return array.filter(function (i, p, s) {
            return s.indexOf(i) === p;
        });
    };
    GetNodeVersions.removeInvalid = function (array) {
        return array.filter(function (version) {
            return version !== "0.0.0";
        });
    };
    GetNodeVersions.prototype.processFilter = function (version) {
        var _this = this;
        return Promise
            .resolve(version.filters)
            .reduce(function (lastResult, filter) {
            return Promise.try(function () {
                return _this.filterVersion(version.version, filter);
            }).then(function (result) {
                return result && lastResult;
            });
        }, true);
    };
    GetNodeVersions.prototype.parseString = function (versions) {
        return Promise
            .resolve(versions)
            .then(GetNodeVersions.makeVersion)
            .then(this.resolveKeyword.bind(this))
            .map(this.resolveVersion.bind(this))
            .filter(this.processFilter.bind(this))
            .map(function (version) {
            return version.version;
        })
            .then(function (allVersions) {
            return allVersions.sort(Semver.compare);
        });
    };
    GetNodeVersions.prototype.parseArray = function (versions) {
        return Promise
            .resolve(versions)
            .map(this.parseString.bind(this))
            .then(flatten)
            .then(GetNodeVersions.dedupArray)
            .then(GetNodeVersions.removeInvalid)
            .then(function (allVersions) {
            return allVersions.sort(Semver.compare);
        });
    };
    GetNodeVersions.prototype.resolveKeyword = function (version) {
        var _this = this;
        return Promise
            .try(function () {
            switch (version.version) {
                case "major":
                    return _this.major();
                case "minor":
                    return _this.minor();
                case "patch":
                    return _this.patch();
                case "legacy":
                    return _this.legacy();
                case "all":
                    return _this.all();
                default:
                    if (GetNodeVersions.isPartialVersion(version.version)) {
                        return Promise.resolve([version.version]);
                    }
                    else {
                        return Promise.reject(new Error("Unknown keyword or version: " + version.version));
                    }
            }
        })
            .map(function (resolvedVersion) {
            return {
                filters: version.filters,
                version: resolvedVersion
            };
        });
    };
    GetNodeVersions.prototype.resolveVersion = function (version) {
        return Promise
            .try(this.getVersionList.bind(this))
            .map(GetNodeVersions.extractVersion)
            .reduce(function (bestVersion, testVersion) {
            return SemverLoose.match(version.version, testVersion) && Semver.gt(testVersion, bestVersion)
                ? testVersion
                : bestVersion;
        }, "0.0.0")
            .then(function (resolvedVersion) {
            return {
                filters: version.filters,
                version: resolvedVersion
            };
        });
    };
    GetNodeVersions.prototype.filterVersion = function (version, filterString) {
        var _a = filterString.split(":").map(GetNodeVersions.trim), type = _a[0], test = _a[1];
        switch (type) {
            case "gt":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveGreatestVersion)
                    .then(function (t) {
                    return Semver.gt(version, t);
                });
            case "gte":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveLeastVersion)
                    .then(function (t) {
                    return Semver.gte(version, t);
                });
            case "lt":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveLeastVersion)
                    .then(function (t) {
                    return Semver.lt(version, t);
                });
            case "lte":
                return Promise
                    .bind(this)
                    .return(test)
                    .then(this.resolveGreatestVersion)
                    .then(function (t) {
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
    };
    GetNodeVersions.prototype.resolveGreatestVersion = function (version) {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .reduce(function (bestVersion, testVersion) {
            return SemverLoose.match(version, testVersion) && Semver.gt(testVersion, bestVersion)
                ? testVersion
                : bestVersion;
        }, "0.0.0");
    };
    GetNodeVersions.prototype.resolveLeastVersion = function (version) {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .reduce(function (bestVersion, testVersion) {
            return SemverLoose.match(version, testVersion) && Semver.lt(testVersion, bestVersion)
                ? testVersion
                : bestVersion;
        }, "9999999.9999999.9999999");
    };
    GetNodeVersions.prototype.major = function () {
        return Promise
            .bind(this)
            .then(this.notLegacy)
            .then(function (remoteVersions) {
            var versions = [];
            remoteVersions.forEach(function (version) {
                var majorVersion = Semver.major(version) + ".x";
                if (versions.indexOf(majorVersion) === -1) {
                    versions.push(majorVersion);
                }
            });
            return versions;
        });
    };
    GetNodeVersions.prototype.minor = function () {
        return Promise
            .bind(this)
            .then(this.notLegacy)
            .then(function (remoteVersions) {
            var versions = [];
            remoteVersions.forEach(function (version) {
                var minorVersion = Semver.major(version) + "." + Semver.minor(version) + ".x";
                if (versions.indexOf(minorVersion) === -1) {
                    versions.push(minorVersion);
                }
            });
            return versions;
        });
    };
    GetNodeVersions.prototype.patch = function () {
        return Promise
            .bind(this)
            .then(this.notLegacy)
            .then(function (remoteVersions) {
            var versions = [];
            remoteVersions.forEach(function (version) {
                var patchVersion = Semver.major(version) + "." + Semver.minor(version) + "." + Semver.patch(version);
                if (versions.indexOf(patchVersion) === -1) {
                    versions.push(patchVersion);
                }
            });
            return versions;
        });
    };
    GetNodeVersions.prototype.legacy = function () {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .filter(GetNodeVersions.isLegacy);
    };
    GetNodeVersions.prototype.notLegacy = function () {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion)
            .filter(GetNodeVersions.isNotLegacy);
    };
    GetNodeVersions.prototype.all = function () {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .map(GetNodeVersions.extractVersion);
    };
    GetNodeVersions.prototype.isLts = function (version) {
        return Promise
            .bind(this)
            .then(this.getVersionList)
            .reduce(function (passed, remoteVersion) {
            return passed || (Semver.eq(version, remoteVersion.version) && !!remoteVersion.lts);
        }, false);
    };
    GetNodeVersions.prototype.getVersionList = function () {
        if (GetNodeVersions.versionListCache) {
            return Promise.resolve(GetNodeVersions.versionListCache);
        }
        else {
            return new Promise((function (resolve, reject) {
                var lib = GetNodeVersions.NODEJS_MIRROR.substr(0, 5) === "https" ? require("https") : require("http");
                var request = lib.get(GetNodeVersions.NODEJS_MIRROR + "/index.json", function (response) {
                    if (response.statusCode < 200 || response.statusCode > 299) {
                        return reject("Failed to load nodejs version list from: " + GetNodeVersions.NODEJS_MIRROR);
                    }
                    var body = [];
                    response.on("data", function (data) {
                        body.push(data.toString());
                    });
                    response.on("end", function () {
                        try {
                            GetNodeVersions.versionListCache = JSON.parse(body.join(""));
                        }
                        catch (e) {
                            reject(e);
                        }
                        resolve(GetNodeVersions.versionListCache);
                    });
                });
                request.on("error", reject);
            }));
        }
    };
    GetNodeVersions.NODEJS_MIRROR = "https://nodejs.org/dist/";
    return GetNodeVersions;
}());
exports.GetNodeVersions = GetNodeVersions;
var UnresolvedVersion = (function () {
    function UnresolvedVersion() {
    }
    return UnresolvedVersion;
}());
var VersionListCacheItem = (function () {
    function VersionListCacheItem() {
    }
    return VersionListCacheItem;
}());
exports.VersionListCacheItem = VersionListCacheItem;
