import { cborDecode, getMonitoredChains, MonitorConfig } from "@ethereum-sourcify/core";
import { Injector } from "@ethereum-sourcify/verification";
import Logger from "bunyan";
import Web3 from "web3";
import SourceFetcher from "./source-fetcher";
import { SourceAddress } from "./util";
import { ethers } from "ethers";
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
    private lastBlockNumber: number;

    constructor(name: string, chainId: string, web3Url: string, contractAssembler: ContractAssembler, injector: Injector) {
        this.chainId = chainId;
        this.web3Provider = new Web3(web3Url);
        this.contractAssembler = contractAssembler;
        this.logger = new Logger({ name });
        this.injector = injector;
    }

    start(): void {
        this.web3Provider.eth.getBlockNumber((err, blockNumber) => {
            if (err) {
                throw new Error(err.message);
            }
            this.logger.info({ loc: "[MONITOR:START]", blockNumber }, "Starting monitor");
            this.lastBlockNumber = blockNumber - 1;
            setInterval(this.processNextBlock, 5000); // TODO
        });
    }

    stop(): void {
        throw new Error("Not implemented");
    }

    private processNextBlock = () => {
        this.web3Provider.eth.getBlock(this.lastBlockNumber + 1, true, (err, block) => {
            if (err) {
                this.logger.error({ loc: "[PROCESS_NEXT_BLOCK]" }, err.message);
                return;
            }

            if (!block) {
                this.logger.info({ loc: "[PROCESS_NEXT_BLOCK]" }, "Waiting for new blocks");
                return;
            }

            this.lastBlockNumber++;

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
        });
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
        } else if (cborData.bzzr0) {
            const metadataId = Web3.utils.bytesToHex(cborData.bzzr0).slice(2);
            return new SourceAddress("bzzr0", metadataId);
        }

        const msg = `Unsupported metadata file format: ${Object.keys(cborData)}`;
        this.logger.error(msg);
        throw new Error(msg);
    }
}

export default class Monitor {
    private chainMonitors: ChainMonitor[];

    constructor(config: MonitorConfig) {
        const contractAssembler = new ContractAssembler(new SourceFetcher());
        const injector = Injector.createOffline({
            log: new Logger({ name: "Monitor" }),
            repositoryPath: config.repository
        });

        const chains = getMonitoredChains();
        this.chainMonitors = chains.map((chain: any) => new ChainMonitor(
            chain.name,
            chain.chainId.toString(),
            chain.web3[0].replace("${INFURA_ID}", process.env.INFURA_ID),
            contractAssembler,
            injector
        ));
    }

    start(): void {
        this.chainMonitors.forEach(chainMonitor => chainMonitor.start());
    }

    stop(): void {
        this.chainMonitors.forEach(chainMonitor => chainMonitor.stop());
    }
}