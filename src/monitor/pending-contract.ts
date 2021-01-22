import { StringMap } from '@ethereum-sourcify/core';
import { SourceFetcher, SourceAddress } from './source-fetcher';
import Logger from 'bunyan';
import Web3 from 'web3';
import { CheckedContract } from '@ethereum-sourcify/core';

type PendingSource = { keccak256: string, urls: string[], name: string };
interface PendingSourceMap {
    [name: string]: PendingSource;
}
type Metadata = { sources: PendingSourceMap };

export default class PendingContract {
    private metadata: Metadata;
    private pendingSources: PendingSourceMap;
    private fetchedSources: StringMap;
    private sourceFetcher: SourceFetcher;
    private callback: (contract: CheckedContract) => any;
    private logger = new Logger({ name: "Pending Contract" });

    constructor(metadataAddress: SourceAddress, sourceFetcher: SourceFetcher, callback: (checkedContract: CheckedContract) => any) {
        this.sourceFetcher = sourceFetcher;
        this.sourceFetcher.subscribe(metadataAddress, this.addMetadata);
        this.callback = callback;
    }

    private addMetadata = (rawMetadata: string) => {
        this.metadata = JSON.parse(rawMetadata);
        this.pendingSources = {};
        for (const name in this.metadata.sources) {
            const source = this.metadata.sources[name];
            source.name = name;
            this.pendingSources[source.keccak256] = source;

            for (const url of source.urls) { // TODO make this more efficient; this might leave unnecessary subscriptions hanging
                this.sourceFetcher.subscribe(SourceAddress.from(url), this.addFetchedSource);
            }

        }
    }

    private addFetchedSource = (name: string, source: string) => {
        const hash = Web3.utils.keccak256(source);
        const deleted = delete this.pendingSources[hash];

        if (!deleted) {
            const msg = `Attempted addition of a nonrequired source (${hash}) to contract`; // TODO id of contract
            this.logger.error({ loc: "[PENDING_CONTRACT]", hash}, msg); // TODO id of contract
            throw new Error(msg);
        }

        this.fetchedSources[name] = source;
        if (isObjectEmpty(this.pendingSources)) {
            const contract = new CheckedContract(this.metadata, this.fetchedSources);
            this.callback(contract);
        }
    }
}

function isObjectEmpty(object: any): boolean {
    return Object.keys(object).length === 0;
}