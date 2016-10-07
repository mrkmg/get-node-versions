/// <reference types="bluebird" />
import * as Promise from "bluebird";
export declare class GetNodeVersions {
    static NODEJS_MIRROR: string;
    static versionListCache: Array<VersionListCacheItem>;
    static parse(versions: string | Array<string>): Promise<Array<string>>;
    private static extractVersion(version);
    private static trim(input);
    private static isLegacy(version);
    private static isNotLegacy(version);
    private static makeVersion(str);
    private static isPartialVersion(str);
    private static dedupArray(array);
    private static removeInvalid(array);
    private processFilter(version);
    private parseString(versions);
    private parseArray(versions);
    private resolveKeyword(version);
    private resolveVersion(version);
    private filterVersion(version, filterString);
    private resolveGreatestVersion(version);
    private resolveLeastVersion(version);
    private major();
    private minor();
    private patch();
    private legacy();
    private notLegacy();
    private all();
    private isLts(version);
    private getVersionList();
}
export declare class VersionListCacheItem {
    version: string;
    date: string;
    files: Array<string>;
    npm: string;
    v8: string;
    uv: string;
    zlib: string;
    openssl: string;
    modules: string;
    lts: boolean;
}
