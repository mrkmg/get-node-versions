declare module "flatten" {
    interface IList<T> {
        [index: number]: T;
        length: number;
    }
    interface IRecursiveArray<T> extends Array<T|IRecursiveArray<T>> {}
    interface IListOfRecursiveArraysOrValues<T> extends IList<T|IRecursiveArray<T>> {}

    function flatten<T>(array: IListOfRecursiveArraysOrValues<T>, isDeep: boolean): T[];
    function flatten<T>(array: IList<T|T[]>): T[];
    function flatten<T>(array: IListOfRecursiveArraysOrValues<T>): IRecursiveArray<T>;

    export = flatten;
}
