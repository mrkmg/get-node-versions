declare module "semver-loose" {
    export function match(range: string, version?: string): boolean;
    export function compare(range: SemverVersion, version: SemverVersion): boolean;
    export function parse(version: string): SemverVersion;
    export function sort(a: SemverVersion | string, b: SemverVersion | string): number;

    export class SemverVersion {
        public major?: number;
        public minor?: number;
        public patch?: number;
        public tag?: string;
        public gte?: boolean;
    }
}
