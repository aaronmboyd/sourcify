import Logger from "bunyan";
import nodeFetch from 'node-fetch';
import { IGateway, SimpleGateway } from "./gateway";
import { SourceAddress, FetchedFileCallback } from "./util";

type Subscription = {
    sourceAddress: SourceAddress;
    subscribers: Array<FetchedFileCallback>;
}

declare interface SubscriptionMap {
    [hash: string]: Subscription
}

export default class SourceFetcher {
    private subscriptions: SubscriptionMap = {};
    private logger = new Logger({ name: "SourceFetcher" });

    private gateways: IGateway[] = [
        new SimpleGateway("ipfs", "https://ipfs.infura.io:5001/api/v0/cat?arg="),
        new SimpleGateway("bzzr1", "https://swarm-gateways.net/bzz-raw:/"),
        new SimpleGateway("bzzr0", "https://swarm-gateways.net/bzz-raw:/")
    ];

    constructor(refreshInterval = 15) {
        setInterval(this.fetch, refreshInterval * 1000);
    }

    private fetch = (): void => {
        for (const sourceHash in this.subscriptions) {
            const subscription = this.subscriptions[sourceHash];
            const gateway = this.findGateway(subscription.sourceAddress);
            const fetchUrl = gateway.createUrl(subscription.sourceAddress.id);
            nodeFetch(fetchUrl).then(resp => {
                if (resp.status === 200) {
                    resp.text().then(file => {
                        this.notifySubscribers(sourceHash, file);
                    });

                } else {
                    resp.text().then(msg => this.logger.error({
                        loc: "[SOURCE_FETCHER:FETCH_FAILED]",
                        status: resp.status,
                        statusText: resp.statusText
                    }, msg));
                }
            }).catch(err => {
                this.logger.error({
                    loc: "[SOURCE_FETCHER]",
                }, err.message);
            });
        }
    }

    private findGateway(sourceAddress: SourceAddress) {
        for (const gateway of this.gateways) {
            if (gateway.worksWith(sourceAddress.origin)) {
                return gateway;
            }
        }

        throw new Error(`Gateway not found for ${sourceAddress.origin}`);
    }

    private notifySubscribers(id: string, file: string) {
        if (!(id in this.subscriptions)) {
            return;
        }

        const subscription = this.subscriptions[id];
        delete this.subscriptions[id];

        this.logger.info({
            loc: "[SOURCE_FETCHER:NOTIFY]",
            id,
            subscribers: subscription.subscribers.length
        }, "notifying of successful fetching");

        subscription.subscribers.forEach(callback => callback(file));
    }

    subscribe(sourceAddress: SourceAddress, callback: FetchedFileCallback): void {
        const sourceHash = sourceAddress.getUniqueIdentifier();
        if (!(sourceHash in this.subscriptions)) {
            this.subscriptions[sourceHash] = { sourceAddress, subscribers: [] };
        }

        this.subscriptions[sourceHash].subscribers.push(callback);
    }
}