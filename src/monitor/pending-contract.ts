import { StringMap } from '@ethereum-sourcify/core';
import SourceFetcher from './source-fetcher';
import { SourceAddress } from "./util";
import Logger from 'bunyan';
import Web3 from 'web3';
import { CheckedContract, isEmpty } from '@ethereum-sourcify/core';

type PendingSource = { keccak256: string, urls: string[], name: string };
interface PendingSourceMap {
    [keccak256: string]: PendingSource;
}
type Metadata = { sources: PendingSourceMap };

export default class PendingContract {
    private metadata: Metadata;
    private pendingSources: PendingSourceMap;
    private fetchedSources: StringMap = {};
    private sourceFetcher: SourceFetcher;
    private callback: (contract: CheckedContract) => void;
    private logger = new Logger({ name: "Pending Contract" });

    constructor(metadataAddress: SourceAddress, sourceFetcher: SourceFetcher, callback: (checkedContract: CheckedContract) => void) {
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

    private addFetchedSource = (sourceContent: string) => {
        const hash = Web3.utils.keccak256(sourceContent);
        const source = this.pendingSources[hash];

        if (source.name in this.fetchedSources) {
            return;
        }

        if (!source) {
            const msg = `Attempted addition of a nonrequired source (${hash}) to contract`; // TODO id of contract
            this.logger.error({ loc: "[PENDING_CONTRACT]", hash}, msg); // TODO id of contract
            throw new Error(msg);
        }

        delete this.pendingSources[hash];
        this.fetchedSources[source.name] = sourceContent;

        if (isEmpty(this.pendingSources)) {
            const contract = new CheckedContract(this.metadata, this.fetchedSources);
            this.callback(contract);
        }
    }
}