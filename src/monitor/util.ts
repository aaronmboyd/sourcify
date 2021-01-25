export type SourceOrigin = "ipfs" | "bzzr1" | "bzzr0"; // TODO bzzr0?

export type FetchedFileCallback= (fetchedFile: string) => any;

const IPFS_PREFIX = "dweb:/ipfs/";
const SWARM_PREFIX = "bzz-raw:/";

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
        if (url.startsWith(IPFS_PREFIX)) {
            return new SourceAddress("ipfs", url.slice(IPFS_PREFIX.length));

        } else if (url.startsWith(SWARM_PREFIX)) {
            return new SourceAddress("bzzr1", url.slice(SWARM_PREFIX.length));
        }

        throw new Error(`Could not deduce source origin from url: ${url}`);
    }
}