const bitcoin = require('bitcoinjs-lib');
const reverse = require('buffer-reverse');

const BigNumber = require('bignumber.js');

module.exports.txhexToElectrumTransaction = function (txhex, network) {
    const tx = bitcoin.Transaction.fromHex(txhex);

    const ret = {
        txid: tx.getId(),
        hash: tx.getHash(true).toString('hex').match(/../g).reverse().join(""),
        version: tx.version,
        size: Math.ceil(txhex.length / 2),
        vsize: tx.virtualSize(),
        weight: tx.weight(),
        locktime: tx.locktime,
        vin: [],
        vout: [],
        hex: txhex,
        blockhash: '',
        confirmations: 0,
        time: 0,
        blocktime: 0,
    };

    for (const inn of tx.ins) {
        const txinwitness = [];
        if (inn.witness[0]) txinwitness.push(inn.witness[0].toString('hex'));
        if (inn.witness[1]) txinwitness.push(inn.witness[1].toString('hex'));

        ret.vin.push({
            txid: reverse(inn.hash).toString('hex'),
            vout: inn.index,
            scriptSig: { hex: inn.script.toString('hex'), asm: '' },
            txinwitness,
            sequence: inn.sequence,
        });
    }

    let n = 0;
    for (const out of tx.outs) {
        const value = new BigNumber(out.value).dividedBy(100000000).toNumber();
        let address = false;
        let type = false;

        if (SegwitBech32Wallet_scriptPubKeyToAddress(out.script.toString('hex'), network)) {

            address = SegwitBech32Wallet_scriptPubKeyToAddress(out.script.toString('hex'), network);
            type = 'witness_v0_keyhash';
        } else if (SegwitP2SHWallet_scriptPubKeyToAddress(out.script.toString('hex'), network)) {
            address = SegwitP2SHWallet_scriptPubKeyToAddress(out.script.toString('hex'), network);
            type = '???'; // TODO
        } else if (LegacyWallet_scriptPubKeyToAddress(out.script.toString('hex'), network)) {
            address = LegacyWallet_scriptPubKeyToAddress(out.script.toString('hex'), network);
            type = '???'; // TODO
        }

        ret.vout.push({
            value,
            n,
            scriptPubKey: {
                asm: '',
                hex: out.script.toString('hex'),
                reqSigs: 1, // todo
                type,
                addresses: [address],
            },
        });
        n++;
    }
    return ret;
}

const SegwitBech32Wallet_scriptPubKeyToAddress = (scriptPubKey, network) => {
    const scriptPubKey2 = Buffer.from(scriptPubKey, 'hex');
    let ret;
    try {
        ret = bitcoin.payments.p2wpkh({
            output: scriptPubKey2,
            network: network,
        }).address;
    } catch (_) {
        return false;
    }
    return ret;
}

const SegwitP2SHWallet_scriptPubKeyToAddress = (scriptPubKey, network) => {
    const scriptPubKey2 = Buffer.from(scriptPubKey, 'hex');
    let ret;
    try {
        ret = bitcoin.payments.p2sh({
            output: scriptPubKey2,
            network: network,
        }).address;
    } catch (_) {
        return false;
    }
    return ret;
}

const LegacyWallet_scriptPubKeyToAddress = (scriptPubKey, network) => {
    const scriptPubKey2 = Buffer.from(scriptPubKey, 'hex');
    let ret;
    try {
        ret = bitcoin.payments.p2pkh({
            output: scriptPubKey2,
            network: network,
        }).address;
    } catch (_) {
        return false;
    }
    return ret;
}

module.exports.estimateCurrentBlockheight = function (latestBlockheight, latestBlockheightTimestamp) {

    if (!!latestBlockheight && !!latestBlockheightTimestamp) {
        const timeDiff = Math.floor(+new Date() / 1000) - latestBlockheightTimestamp;
        const extraBlocks = Math.floor(timeDiff / (9.93 * 60));
        return latestBlockheight + extraBlocks;
    }

    const baseTs = 1587570465609; // uS
    const baseHeight = 627179;
    return Math.floor(baseHeight + (+new Date() - baseTs) / 1000 / 60 / 9.93);
};

module.exports.calculateBlockTime = function (height, latestBlockheight, latestBlockheightTimestamp) {

    if (latestBlockheight) {
        return Math.floor(latestBlockheightTimestamp + (height - latestBlockheight) * 9.93 * 60);
    }

    const baseTs = 1585837504; // sec
    const baseHeight = 624083;
    return Math.floor(baseTs + (height - baseHeight) * 9.93 * 60);
};