import { CheckedContract } from "@ethereum-sourcify/core";
import PendingContract from "./pending-contract";
import SourceFetcher from "./source-fetcher";
import { SourceAddress } from "./util";

export default class ContractAssembler {

    private sourceFetcher: SourceFetcher;

    constructor(sourceFetcher: SourceFetcher) {
        this.sourceFetcher = sourceFetcher;
    }

    assemble(metadataAddress: SourceAddress, callback: (contract: CheckedContract) => void) {
        new PendingContract(metadataAddress, this.sourceFetcher, callback);
    }
}