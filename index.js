//global.net = require('net'); // needed by Electrum client. For RN it is proviced in shim.js
//global.tls = require('tls'); // needed by Electrum client. For RN it is proviced in shim.js


const ElectrumClient = require('electrum-client');

const bitcoin = require('bitcoinjs-lib');
const reverse = require('buffer-reverse');

const BigNumber = require('bignumber.js');

const utils = require("./utils");

const TESTNET = bitcoin.networks.testnet;

const MAINNET = bitcoin.networks.bitcoin;

class ElectrumConnection {

    constructor(electrumPeer, network) {
        this.electrumPeer = electrumPeer;
        this.network = network;
        this.txhashHeightCache = {};
    }

    async connect() {

        this.mainClient = false;

        try {
            console.log('begin connection:', JSON.stringify(this.electrumPeer));
            this.mainClient = new ElectrumClient(this.electrumPeer.ssl || this.electrumPeer.tcp, this.electrumPeer.host, this.electrumPeer.ssl ? 'tls' : 'tcp');
            this.mainClient.onError = (e) => {
                throw new Error(e);
            };
            const ver = await this.mainClient.initElectrum({ client: 'bitcoin-walllet-lib', version: '1.4' });
            if (ver && ver[0]) {
                console.log('connected to ', ver);
                this.mainClient.serverName = ver[0];
                if (ver[0].startsWith('ElectrumPersonalServer') || ver[0].startsWith('electrs')) {
                    // TODO: once they release support for batching - disable batching only for lower versions
                    this.mainClient.disableBatching = true;
                    console.log(' disableBatching = true');
                }

                const header = await this.mainClient.blockchainHeaders_subscribe();
                if (header && header.height) {
                    this.mainClient.latestBlockheight = header.height;
                    this.mainClient.latestBlockheightTimestamp = Math.floor(+new Date() / 1000);
                }
            }

        } catch (e) {
            console.log('bad connection:', JSON.stringify(this.electrumPeer), e);
            throw new Error(e);
        }
    }

    async getConfig() {
        if (!this.mainClient) throw new Error('Electrum client is not connected');
        return {
            host: this.mainClient.host,
            port: this.mainClient.port,
            status: this.mainClient.status ? 1 : 0,
            serverName: this.mainClient.serverName,
        };
    }

    async closeConnection() {
        await this.mainClient.close();
        console.log('Connection closed');
    }

    async estimateFee(_numberOfBlocks) {
        if (!this.mainClient || !this.mainClient.status) throw new Error('Electrum client is not connected');
        const numberOfBlocks = _numberOfBlocks || 1;
        const coinUnitsPerKilobyte = await this.mainClient.blockchainEstimatefee(numberOfBlocks);
        //console.log(`${numberOfBlocks}: ${coinUnitsPerKilobyte} coinUnitsPerKilobyte`);
        if (coinUnitsPerKilobyte === -1) return 1;
        return Math.round(new BigNumber(coinUnitsPerKilobyte).dividedBy(1024).multipliedBy(100000000).toNumber());
    }

    async estimateFees() {
        const fast = await module.exports.estimateFee(this.mainClient, 1);
        const medium = await module.exports.estimateFee(this.mainClient, 18);
        const slow = await module.exports.estimateFee(this.mainClient, 144);
        return { fast, medium, slow };
    }

    async getTransactionsByAddress(address) {
        if (!this.mainClient || !this.mainClient.status) throw new Error('Electrum client is not connected');
        const script = bitcoin.address.toOutputScript(address, this.network);
        const hash = bitcoin.crypto.sha256(script);
        const reversedHash = Buffer.from(reverse(hash));
        const history = await this.mainClient.blockchainScripthash_getHistory(reversedHash.toString('hex'));
        // TODO Check it
        //if (history.tx_hash) this.txhashHeightCache[history.tx_hash] = history.height; // cache tx height
        return history;
    }

    splitIntoChunks(arr, chunkSize) {
        const groups = [];
        let i;
        for (i = 0; i < arr.length; i += chunkSize) {
            groups.push(arr.slice(i, i + chunkSize));
        }
        return groups;
    }


    async multiGetHistoryByAddresses(addresses, _batchsize) {
        const batchsize = _batchsize || 100;
        if (!this.mainClient || !this.mainClient.status) throw new Error('Electrum client is not connected');
        const ret = {};

        const chunks = this.splitIntoChunks(addresses, batchsize);
        for (const chunk of chunks) {
            const scripthashes = [];
            const scripthash2addr = {};
            for (const addr of chunk) {
                const script = bitcoin.address.toOutputScript(addr, this.network);
                const hash = bitcoin.crypto.sha256(script);
                let reversedHash = Buffer.from(reverse(hash));
                reversedHash = reversedHash.toString('hex');
                scripthashes.push(reversedHash);
                scripthash2addr[reversedHash] = addr;
            }

            let results = [];

            if (this.mainClient.disableBatching) {
                for (const sh of scripthashes) {
                    const history = await this.mainClient.blockchainScripthash_getHistory(sh);
                    results.push({ result: history, param: sh });
                }

            } else {
                results = await this.mainClient.blockchainScripthash_getHistoryBatch(scripthashes);
            }

            for (const history of results) {
                //ret[scripthash2addr[history.param]] = history.result;
                //if (history.result[0]) this.txhashHeightCache[history.result[0].tx_hash] = history.result[0].height; // cache tx height
                if (history.error) console.warn('multiGetHistoryByAddress():', history.error);
                ret[scripthash2addr[history.param]] = history.result || [];

                for (const hist of ret[scripthash2addr[history.param]]) {
                    hist.address = scripthash2addr[history.param];
                }
            }
        }

        return ret;
    };


    async multiGetUtxoByAddresses(addresses, _batchsize) {
        const batchsize = _batchsize || 100;
        if (!this.mainClient || !this.mainClient.status) throw new Error('Electrum client is not connected');
        const ret = {};

        const chunks = this.splitIntoChunks(addresses, batchsize);
        for (const chunk of chunks) {
            const scripthashes = [];
            const scripthash2addr = {};
            for (const addr of chunk) {
                const script = bitcoin.address.toOutputScript(addr, this.network);
                const hash = bitcoin.crypto.sha256(script);
                let reversedHash = Buffer.from(reverse(hash));
                reversedHash = reversedHash.toString('hex');
                scripthashes.push(reversedHash);
                scripthash2addr[reversedHash] = addr;
            }

            let results = [];


            // TODO: Electrs supoprts blockchainScripthash_listunspent. (not batch ?)
            if (this.mainClient.disableBatching) {
                // ElectrumPersonalServer doesnt support `blockchain.scripthash.listunspent` (not batch ?)
                for (const scripthash of scripthashes) {
                    //console.log(scripthash);
                    //console.log("Buscando " + scripthash2addr[scripthash]);
                    let result = await this.mainClient.blockchainScripthash_listunspent(scripthash);
                    // console.log(result);

                    ret[scripthash2addr[scripthash]] = result;
                    for (const utxo of ret[scripthash2addr[scripthash]]) {
                        utxo.address = scripthash2addr[scripthash];
                        utxo.txId = utxo.tx_hash;
                        utxo.vout = utxo.tx_pos;
                        delete utxo.tx_pos;
                        delete utxo.tx_hash;
                    }
                }
                //console.log(ret);
                //throw new Error('ElectrumPersonalServer doesnt support `blockchain.scripthash.listunspent`');
            } else {
                results = await this.mainClient.blockchainScripthash_listunspentBatch(scripthashes);

                for (const utxos of results) {
                    ret[scripthash2addr[utxos.param]] = utxos.result;
                    for (const utxo of ret[scripthash2addr[utxos.param]]) {
                        utxo.address = scripthash2addr[utxos.param];
                        utxo.txId = utxo.tx_hash;
                        utxo.vout = utxo.tx_pos;
                        delete utxo.tx_pos;
                        delete utxo.tx_hash;
                    }
                }
            }
        }

        return ret;
    };

    async getTransactionFromNonVerbose(_rawHexTx) {
        let tx = utils.txhexToElectrumTransaction(_rawHexTx, this.network);

        if (!this.txhashHeightCache[tx.txid]
            && !!tx.vout
            && !!tx.vout[0]
            && !!tx.vout[0].scriptPubKey
            && !!tx.vout[0].scriptPubKey.addresses
            && !!tx.vout[0].scriptPubKey.addresses[0]) {

            let address = tx.vout[0].scriptPubKey.addresses[0];

            const script = bitcoin.address.toOutputScript(address, this.network);
            const hash = bitcoin.crypto.sha256(script);
            let reversedHash = Buffer.from(reverse(hash)).toString('hex');

            const history = await this.mainClient.blockchainScripthash_getHistory(reversedHash);
            let txInfo = history.find(t => t.tx_hash == tx.txid)
            let height = (!!txInfo) ? txInfo.height : 0;

            this.txhashHeightCache[tx.txid] = height;
        }


        if (this.txhashHeightCache[tx.txid]) {

            const latestBlockheight = this.mainClient.latestBlockheight;
            const latestBlockheightTimestamp = this.mainClient.latestBlockheightTimestamp;

            tx.confirmations = utils.estimateCurrentBlockheight(latestBlockheight, latestBlockheightTimestamp) - this.txhashHeightCache[tx.txid];
            if (tx.confirmations < 0) {
                // ugly fix for when estimator lags behind
                tx.confirmations = 1;
            }

            const blocktime = utils.calculateBlockTime(this.txhashHeightCache[tx.txid], latestBlockheight, latestBlockheightTimestamp);

            tx.time = blocktime;
            tx.blocktime = blocktime;
        }

        return tx;
    }

    async multiGetTransactionByTxid(txids, _batchsize) {
        const batchsize = _batchsize || 45;
        if (!this.mainClient || !this.mainClient.status) throw new Error('Electrum client is not connected');

        const ret = {};
        txids = [...new Set(txids)]; // deduplicate just for any case

        let results = [];

        const chunks = this.splitIntoChunks(txids, batchsize);
        for (const chunk of chunks) {


            if (this.mainClient.disableBatching) {
                for (const txid of chunk) {
                    // in case of ElectrumPersonalServer it might not track some transactions (like source transactions for our transactions)
                    // so we wrap it in try-catch

                    let tx = null;

                    try {
                        tx = await this.mainClient.blockchainTransaction_get(txid, true);
                    } catch (_) {
                        try {
                            tx = await this.mainClient.blockchainTransaction_get(txid, false);
                        } catch (_) { }
                    }

                    if (typeof tx === 'string') {
                        tx = await this.getTransactionFromNonVerbose(tx);
                    }

                    if (!!tx) {
                        results.push({ result: tx, param: txid });
                    }
                }
            }
            else {
                results = await this.mainClient.blockchainTransaction_getBatch(chunk, true);

            }


        }

        for (const txdata of results) {
            ret[txdata.param] = txdata.result;
        }

        return ret;
    }

}

/*
const main = async () => {
    const electrumConnection = new ElectrumConnection({ host: 'testnet.aranguren.org', ssl: '51002' }, TESTNET);
    await electrumConnection.connect();
    await electrumConnection.closeConnection();
}

main();
*/

module.exports = { TESTNET, MAINNET, ElectrumConnection };