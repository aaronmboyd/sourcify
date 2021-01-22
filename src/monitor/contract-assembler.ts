import { CheckedContract } from "@ethereum-sourcify/core";
import PendingContract from "./pending-contract";
import { SourceAddress, SourceFetcher } from "./source-fetcher";

export default class ContractAssembler {

    private sourceFetcher: SourceFetcher;

    constructor(sourceFetcher: SourceFetcher) {
        this.sourceFetcher = sourceFetcher;
    }

    assemble(metadataAddress: SourceAddress, callback: (contract: CheckedContract) => any) { // TODO function type
        new PendingContract(metadataAddress, this.sourceFetcher, callback);
    }
}