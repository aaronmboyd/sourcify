export type SourceOrigin = "ipfs" | "bzzr1" | "bzzr0"; // TODO bzzr0?

export type FetchedFileCallback= (fetchedFile: string) => any;

interface Prefix {
    regex: RegExp,
    origin: SourceOrigin
}

const PREFIXES: Prefix[] = [
    { origin: "ipfs", regex: /dweb:\/ipfs\/{1,2}/ },
    { origin: "bzzr1", regex: /bzz-raw:\/{1,2}/ }
];

export class SourceAddress {
    origin: SourceOrigin;
    id: string;

    constructor(origin: SourceOrigin, id: string) {
        this.origin = origin;
        this.id = id;
    }

    getUniqueIdentifier(): string {
        return this.origin + "-" + this.id;
    }

    static from(url: string): SourceAddress {
        for (const prefix of PREFIXES) {
            const attempt = url.replace(prefix.regex, "");
            if (attempt !== url) {
                return new SourceAddress(prefix.origin, attempt);
            }
        }

        return null;
    }
}