global.net = require('net'); // needed by Electrum client. For RN it is proviced in shim.js
global.tls = require('tls'); // needed by Electrum client. For RN it is proviced in shim.js

const { TESTNET, ElectrumConnection } = require("../index");
const { describe, it, after, before } = require('mocha');
var chai = require('chai');
var expect = chai.expect;


// TX time and blocktime not reliable
describe('tests on testnet, server: Electrs-Esplora', () => {

    let electrumConnection;

    before('connecting to server', function () {
        electrumConnection = new ElectrumConnection({ host: 'blockstream.info', ssl: '993' }, TESTNET);
        return electrumConnection.connect();
    });

    after('connecting to server', async function () {
        return electrumConnection.closeConnection();
    });

    it('simple connection',
        async () => {
            //const electrumConnection = new ElectrumConnection({ host: 'testnet.aranguren.org', ssl: '51002' }, networks.testnet);
            // await electrumConnection.connect();

            const config = await electrumConnection.getConfig();

            /*expect(config.host).to.equal('testnet.aranguren.org');
            expect(config.port).to.equal('51002');*/
            expect(config.status).to.equal(1);
            expect(config.serverName).to.be.a("string")

            // await electrumConnection.closeConnection();
        })

    it('test getTransactionsByAddress',
        async () => {
            //const electrumConnection = new ElectrumConnection({ host: 'testnet.aranguren.org', ssl: '51002' }, networks.testnet);
            // await electrumConnection.connect();

            let txs = await electrumConnection.getTransactionsByAddress("tb1qs66wfpglry4h9z089uw9ypjzygsasvqqujfx0u");

            expect(txs.length).to.equal(2);
            expect(txs[0].tx_hash).to.equal("34656da15bb76dad035e8ef41736746ae69a5d7bc594e8d8e279cd7200d608b2");
            expect(txs[0].height).to.equal(1808274);
            expect(txs[1].tx_hash).to.equal("f878d42858b9c4d68e07f9fb88f1719a6d498cb0044e08b9c24e2007e6638b59");
            expect(txs[1].height).to.equal(1808280);

            // await electrumConnection.closeConnection();
        })

    it('test multiGetHistoryByAddresses (transactions by multiple addresses)',
        async () => {
            // const electrumConnection = new ElectrumConnection({ host: 'testnet.aranguren.org', ssl: '51002' }, networks.testnet);
            // await electrumConnection.connect();

            const addr1 = "tb1qs66wfpglry4h9z089uw9ypjzygsasvqqujfx0u";
            const addr2 = "tb1q5sv9d9mfs8hnnrg7qfd5k9qzm8mhv4wmnzp984";
            const addr3 = "mieZyoL2MGRosr4R7DTqiDBvhHV3Jvtd1t";

            let txs = await electrumConnection.multiGetHistoryByAddresses([addr1, addr2, addr3]);

            expect(txs[addr1].length).to.equal(2);
            expect(txs[addr1][0].tx_hash).to.equal("34656da15bb76dad035e8ef41736746ae69a5d7bc594e8d8e279cd7200d608b2");
            expect(txs[addr1][0].height).to.equal(1808274);
            expect(txs[addr1][0].address).to.equal(addr1);
            expect(txs[addr1][1].tx_hash).to.equal("f878d42858b9c4d68e07f9fb88f1719a6d498cb0044e08b9c24e2007e6638b59");
            expect(txs[addr1][1].height).to.equal(1808280);
            expect(txs[addr1][1].address).to.equal(addr1);

            expect(txs[addr2].length).to.equal(1);
            expect(txs[addr2][0].tx_hash).to.equal("4d0575abac8509a4c51d3fd0f4acfde6e38fe65a0ae230b2317f492f575acf1e");
            expect(txs[addr2][0].height).to.equal(1808285);
            expect(txs[addr2][0].address).to.equal(addr2);

            expect(txs[addr3].length).to.equal(1);
            expect(txs[addr3][0].tx_hash).to.equal("8868487f68b0a8fc37834c218eaaa67cccab1b452cd73b4d6b9222ad3c103880");
            expect(txs[addr3][0].height).to.equal(1808274);
            expect(txs[addr3][0].address).to.equal(addr3);

            // await electrumConnection.closeConnection();
        })

    it('test multiGetUtxoByAddresses (UTXOs by multiple addresses)',
        async () => {
            // const electrumConnection = new ElectrumConnection({ host: 'testnet.aranguren.org', ssl: '51002' }, networks.testnet);
            // await electrumConnection.connect();

            const addr1 = "tb1qs66wfpglry4h9z089uw9ypjzygsasvqqujfx0u";
            const addr2 = "tb1q5sv9d9mfs8hnnrg7qfd5k9qzm8mhv4wmnzp984";
            const addr3 = "mieZyoL2MGRosr4R7DTqiDBvhHV3Jvtd1t";

            let utxos = await electrumConnection.multiGetUtxoByAddresses([addr1, addr2, addr3]);

            expect(utxos[addr2].length).to.equal(1);
            expect(utxos[addr2][0].height).to.equal(1808285);
            expect(utxos[addr2][0].value).to.equal(15954);
            expect(utxos[addr2][0].address).to.equal(addr2);
            expect(utxos[addr2][0].txId).to.equal("4d0575abac8509a4c51d3fd0f4acfde6e38fe65a0ae230b2317f492f575acf1e");
            expect(utxos[addr2][0].vout).to.equal(0);


            // the order of results is apparently random ...
            utxos[addr3] = utxos[addr3].sort((a, b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0));

            expect(utxos[addr3].length).to.equal(2);
            expect(utxos[addr3][0].height).to.equal(1808274);
            expect(utxos[addr3][0].value).to.equal(40000);
            expect(utxos[addr3][0].address).to.equal(addr3);
            expect(utxos[addr3][0].txId).to.equal("8868487f68b0a8fc37834c218eaaa67cccab1b452cd73b4d6b9222ad3c103880");
            expect(utxos[addr3][0].vout).to.equal(0);
            expect(utxos[addr3][1].height).to.equal(1808274);
            expect(utxos[addr3][1].value).to.equal(59774);
            expect(utxos[addr3][1].address).to.equal(addr3);
            expect(utxos[addr3][1].txId).to.equal("8868487f68b0a8fc37834c218eaaa67cccab1b452cd73b4d6b9222ad3c103880");
            expect(utxos[addr3][1].vout).to.equal(1);

            // await electrumConnection.closeConnection();
        })

    // 34656da15bb76dad035e8ef41736746ae69a5d7bc594e8d8e279cd7200d608b2
    // f878d42858b9c4d68e07f9fb88f1719a6d498cb0044e08b9c24e2007e6638b59

    it('test multiGetTransactionByTxid (Txs by multiple txIds)',
        async () => {
            // const electrumConnection = new ElectrumConnection({ host: 'testnet.aranguren.org', ssl: '51002' }, networks.testnet);
            //  await electrumConnection.connect();

            const tx01 = "4d0575abac8509a4c51d3fd0f4acfde6e38fe65a0ae230b2317f492f575acf1e";
            const tx02 = "8868487f68b0a8fc37834c218eaaa67cccab1b452cd73b4d6b9222ad3c103880";
            const tx03 = "34656da15bb76dad035e8ef41736746ae69a5d7bc594e8d8e279cd7200d608b2";
            const tx04 = "f878d42858b9c4d68e07f9fb88f1719a6d498cb0044e08b9c24e2007e6638b59";

            const txIds = [tx01, tx02, tx03, tx04];

            let txs = await electrumConnection.multiGetTransactionByTxid(txIds);

            expect(txs[tx01].txid).to.equal(tx01);
            expect(txs[tx01].hash).to.equal('8d6afeec8238566718e05cd3544d35620efcb1c580d03215107541e6a7cee87e');
            expect(txs[tx01].hex).to.equal('02000000000101937fc27d2de0660ca3c6ab30dcc15b6f85bfcf4ae4acbcaad932fedab4a3c74501000000171600142e1944e18ecd028eee5d26e2b7b0b895620f4db2ffffffff02523e000000000000160014a41856976981ef398d1e025b4b1402d9f77655db6df800000000000017a9148fd5248f5fdb7521f75691fb8f17c2db9752c2c38702483045022100e10914330359c4d1a1987377c4bd3f011853973f7500ff5c418c91974b00f58902201940d2c564b47d90219b536e6660cfb139744c9fe1aada4b9e42cc9d00f3c2500121027100825bd5d36a84cb55fd3f503a83dd6a21173bcb99d621fd9f7dc235d01f3100000000')
            //   expect(txs[tx01].time).to.equal(1598307302);
            //   expect(txs[tx01].blocktime).to.equal(1598307302);
            expect(txs[tx01].vout[0].scriptPubKey.addresses[0]).to.equal('tb1q5sv9d9mfs8hnnrg7qfd5k9qzm8mhv4wmnzp984');

            expect(txs[tx02].txid).to.equal(tx02);
            expect(txs[tx02].hash).to.equal('8868487f68b0a8fc37834c218eaaa67cccab1b452cd73b4d6b9222ad3c103880');
            expect(txs[tx02].hex).to.equal('02000000018ca05cb545d2bd6a579696c3e922a7445dc8dde15a874dee5856e7aaaf7bca43010000006a473044022005059003fe7dae6051e8acc0bee5e6ab566ce7b9a93210a75c30daf77f937ee30220418d4f427f5e2959f0da38a0dee5e8d0b97fd3184e9251cac90b56785bf62be60121038c25c37bd7f9d504f0948665eebeaa50f61309db978c17e5e84102b41a4c27abffffffff02409c0000000000001976a914225913e094c95621989525a854dc5470d9d2b8f288ac7ee90000000000001976a914225913e094c95621989525a854dc5470d9d2b8f288ac00000000')
            //   expect(txs[tx02].time).to.equal(1598299456);
            //   expect(txs[tx02].blocktime).to.equal(1598299456);
            expect(txs[tx02].vout[0].scriptPubKey.addresses[0]).to.equal('mieZyoL2MGRosr4R7DTqiDBvhHV3Jvtd1t');

            expect(txs[tx03].txid).to.equal(tx03);
            expect(txs[tx03].hash).to.equal('34656da15bb76dad035e8ef41736746ae69a5d7bc594e8d8e279cd7200d608b2');
            expect(txs[tx03].hex).to.equal('02000000012ec3ba47490feb3f9667623d88c525d27bcb4e7004e70264d314ba0ad303ade9010000006b483045022100d26471063507484978925f4d25f751feb52aeaaa5274088264a07c9e67200a5b02206d1a538abc91478902b37d2cb094e8e73d6039bab3e4a0e0073f1ae7d0e800b70121026a702fe93160b691147f2e46580cc9708902de992d769d8045c7da29d44716d0ffffffff02204e00000000000016001486b4e4851f192b7289e72f1c5206422221d83000a13701000000000016001486b4e4851f192b7289e72f1c5206422221d8300000000000')
            // expect(txs[tx03].time).to.equal(1598299456);
            // expect(txs[tx03].blocktime).to.equal(1598299456);
            expect(txs[tx03].vout[0].scriptPubKey.addresses[0]).to.equal('tb1qs66wfpglry4h9z089uw9ypjzygsasvqqujfx0u');

            expect(txs[tx04].txid).to.equal(tx04);
            expect(txs[tx04].hash).to.equal('da4cb1d68701247690b009e692fb83d232c84db03447ee71fcbdfe3c1d73dc8e');
            expect(txs[tx04].hex).to.equal('0200000000010289b2409d4c580074851a7d93fc7daef3e0421ef4571e3f4fc944403ea3f8aa880000000000ffffffffcf6a207a125369dd97ce607691af46c7a8ec03d7ea0000ccb7cdf1bfa1eb5a370000000000ffffffff0259d401000000000016001486b4e4851f192b7289e72f1c5206422221d83000002102000000000016001486b4e4851f192b7289e72f1c5206422221d830000247304402202d82af99b68f4998c43d27555290bfd6cefc952c98263e1973fc8a2aa63b7d1c02200613745b3f0125a62245f064bb98b22ecc94c03303abadce484bf7d9698a96780121034cac91aa1528f3aceb1e3bdc7407c268d25bc5c3b2f52cad036c9b72458291f702483045022100d8794c459b1e93ae7054b1ee7ad9c28cabc8a2d9f32d9975248dd1fe3161779302205bf596cd5eb60cbc1877fbe6020da17c439e085d342e3e9393fd399e3362c88f0121033504f5c45df016d047bc966bba43bd626a1f1f68b9e3a5bd9ec6e8e3a58d8d3c00000000')
            // expect(txs[tx04].time).to.equal(1598303378);
            // expect(txs[tx04].blocktime).to.equal(1598303378);
            expect(txs[tx04].vout[0].scriptPubKey.addresses[0]).to.equal('tb1qs66wfpglry4h9z089uw9ypjzygsasvqqujfx0u');

            // await electrumConnection.closeConnection();
        })

})
