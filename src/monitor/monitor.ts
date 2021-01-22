import { cborDecode, getMonitoredChains, MonitorConfig } from "@ethereum-sourcify/core";
import { Injector } from "@ethereum-sourcify/verification";
import Logger from "bunyan";
import Web3 from "web3";
import { SourceAddress, SourceFetcher } from "./source-fetcher";
import ethers from "ethers";
import ContractAssembler from "./contract-assembler";
// import FetchFinalizer from "./fetch-finalizer"; // TODO delete
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multihashes = require("multihashes");

function createsContract(tx: any): boolean { // TODO type
    return !tx.to;
}

class ChainMonitor {
    private chainId: string;
    private web3Provider: Web3;
    private contractAssembler: ContractAssembler;
    private logger: Logger;
    private injector: Injector;

    constructor(chainId: string, web3Url: string, contractAssembler: ContractAssembler, injector: Injector) {
        this.chainId = chainId;
        this.web3Provider = new Web3(web3Url);
        this.contractAssembler = contractAssembler;
        this.logger = new Logger({ name: `Chain ${chainId}` });
        this.injector = injector;
    }

    start(): void {
        setInterval(this.fetchBlocks, null); // TODO
    }


    stop(): void {
        throw new Error("Not implemented");
    }

    private fetchBlocks = () => { // TODO async or not
        const block = this.fetchNextBlock();
        for (const tx of block.transactions) {
            if (createsContract(tx)) {
                const address = ethers.utils.getContractAddress(tx);
                this.web3Provider.eth.getCode(address).then(bytecode => {
                    const numericBytecode = Web3.utils.hexToBytes(bytecode);
                    const cborData = cborDecode(numericBytecode);
                    const metadataAddress = this.getMetadataAddress(cborData);
                    this.contractAssembler.assemble(metadataAddress, contract => {
                        this.injector.inject({
                            contract,
                            bytecode,
                            chain: this.chainId,
                            addresses: [address]
                        });
                    });
                });
            }
        }
    }

    private fetchNextBlock(): any { // TODO type
        throw new Error("Not implemented");
    }

    private getMetadataAddress(cborData: any): SourceAddress {
        // TODO reduce code duplication
        // TODO what can cborData.keys be?
        if (cborData.ipfs) {
            const metadataId = multihashes.toB58String(cborData.ipfs);
            return new SourceAddress("ipfs", metadataId);
        } else if (cborData.bzzr1) {
            const metadataId = Web3.utils.bytesToHex(cborData.bzzr1).slice(2);
            return new SourceAddress("bzzr1", metadataId);
        }

        const msg = `Unsupported metadata file format: ${Object(cborData).keys()}`;
        this.logger.error(msg);
        throw new Error(msg);
    }
}

export class Monitor {
    private repositoryPath: string;
    private contractAssembler = new ContractAssembler(new SourceFetcher());
    private chainMonitors: ChainMonitor[];
    private injector: Injector;
    private logger = new Logger({ name: "Monitor" });

    constructor(config: MonitorConfig) {
        this.repositoryPath = config.repository || "repository";
        const chains = getMonitoredChains();
        this.injector = Injector.createOffline({
            infuraPID: process.env.infuraPID,
            log: this.logger
        });
        this.chainMonitors = chains.map((chain: any) => new ChainMonitor(
            chain.chainId.toString(),
            chain.web3,
            this.contractAssembler,
            this.injector
        ));
    }

    start(): void {
        this.chainMonitors.forEach(chainMonitor => chainMonitor.start());
    }

    stop(): void {
        this.chainMonitors.forEach(chainMonitor => chainMonitor.stop());
    }
}