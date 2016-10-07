# get-node-versions

get-node-versions is a simple package to get an array of specific node versions.

## Installation

As a library

    npm install --save get-node-versions

As a cli tool

    npm install -g get-node-versions
    
## Usage

As a library

    import {GetNodeVersions} from "get-node-versions"
    
    GetNodeVersions.parse(["major", "minor | eq:6", "0.12"]).then((versions) => {
        console.log(versions);
    });
    
As a cli program

    $ get-node-versions "major | eq:6" "minor | lt:5 | gte:4.0.0"
    4.1.2
    4.2.6
    4.3.2
    4.4.7
    4.5.0
    4.6.0
    6.7.0

## API

**GetNodeVersions**

- `parse(versions: string | Array<string>): Promise<Array<string>>`
    - Parse input and return valid nodejs versions 
- `NODEJS_MIRROR: string`
    - Mirror to use to retrieve the nodejs version list. default: https://nodejs.org/dist/
- `versionListCache: Array<VersionListCacheItem>`
    - Set this to skip pulling versions from the mirror.
    
**VersionListCacheItem**
    
- `version: string`
- `date: string`
- `files: Array<string>`
- `npm: string`
- `v8: string`
- `uv: string`
- `zlib: string`
- `openssl: string`
- `modules: string`
- `lts: boolean`

## Versions Syntax

get-node-versions sports a very flexible version syntax. The version syntax follows the following format:

    (version or keyword) | filter | filter | ...

You must specify one version or one keyword and then any number of filters (or zero). Whitespace is optional.

### Possible Versions

| Version | Example | Description                                     |
|:--------|:--------|:------------------------------------------------|
| X       | 6       | Resolves to the greatest single version of X.   |
| X.Y     | 6.1     | Resolves to the greatest single version of X.Y. |
| X.Y.Z   | 6.1.2   | Resolves to exactly X.Y.Z.                      |

### Possible Keywords

| Keyword | Description                                                                                          |
|:-------:|:-----------------------------------------------------------------------------------------------------|
|  major  | Resolves to a list of all the latest major versions. Does not include legacy versions.               |
|  minor  | Resolves to a list of all the latest minor versions. Does not include legacy versions.               |
|  patch  | Resolves to a list of all patch versions. Does not include legacy versions.                          |
| legacy  | Resolves to a list of all the legacy versions, which is everything that starts with major version 0. |
|   all   | Resolves to every single version available.                                                          |


### Possible Filters

|   Filter    | Description                                                 |
|:-----------:|:------------------------------------------------------------|
| gt:version  | Filter to only versions greater than `version`.             |
| gte:version | Filter to only versions greater than or equal to `version`. |
| lt:version  | Filter to only versions less than `version`.                |
| lte:version | Filter to only versions less than or equal to `version`.    |
| eq:version  | Filter to only versions matching `version`.                 |
| neq:version | Filter to only versions not matching `version`.             |
|     lts     | Filter to only LTS versions.                                |

*`version` can be a partial version.*

### Examples

Minor versions of v6, and major versions of everything else.

    get-node-versions -"minor | eq:6" "major | lt:6"

All major versions, plus a subset of version 4.

    get-node-versions "major" "patch | gte:4.2 | lte:4.6"

Every single LTS version and the *popular* legacy versions.

    get-node-versions "patch | lts" 0.12 0.10

*You do not need to worry if multiple versions overlap, as they are de-duplicated.*

