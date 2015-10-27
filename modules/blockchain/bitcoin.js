var bitcoin = require('bitcoin');
var async = require('async');
var bitcoinlib = require('bitcoinjs-lib');
var bitcore = require('bitcore');
var bigi = require('bigi');


var private = {}, self = null,
	library = null, modules = null;

private.network = {
	messagePrefix: '\x18Bitcoin Signed Message:\n',
	bip32: {
		public: 0x043587cf,
		private: 0x04358394
	},
	pubKeyHash: 0x6f,
	scriptHash: 0xc4,
	wif: 0xef,
	dustThreshold: 546
}

function Bitcoin(cb, _library) {
	self = this;
	library = _library;

	private.client = new bitcoin.Client(library.config.bitcoin.config);
	cb(null, self);
}

Bitcoin.prototype.makePair = function (secret) {
	var hash = bitcoin.crypto.sha256(secret);
	var d = bigi.fromBuffer(hash);
	var keyPair = new bitcoin.ECPair(d, undefined, {
		compressed: false,
		network: private.network
	});

	return keyPair;
}

Bitcoin.prototype.createAddress = function (secret, cb) {
	var keyPair = this.makePair(secret);
	async.series([
		function (cb) {
			private.client.cmd('getaccount', keyPair.getAddress(), function (err, res) {
				if (err || res) {
					return cb(err || "Account exists");
				}
				cb();
			});
		},
		function (cb) {
			private.client.cmd('importprivkey', keyPair.toWIF(), cb);
		},
		function (cb) {
			var block = modules.blockchain.blocks.genesisBlock();
			private.client.cmd('setaccount', keyPair.getAddress(), keyPair.getAddress() + "_" + block.id, cb);
		}
	], function (err) {
		if (err) {
			return cb(err);
		}
		cb(null, {address: keyPair.getAddress(), account: keyPair.getAddress() + "_" + block.id});
	});
}

Bitcoin.prototype.getBalance = function (secret, cb) {
	var keyPair = this.makePair(secret);
	var block = modules.blockchain.blocks.genesisBlock();
	private.client.cmd('getbalance', keyPair.getAddress() + "_" + block.id, function (err, balance) {
		if (err) {
			return cb(err);
		}
		cb(null, {address: keyPair.getAddress(), balance: balance});
	});
}

Bitcoin.prototype.depositTransfer = function (secret, value, cb) {
	var keyPair = this.makePair(secret);
	var block = modules.blockchain.blocks.genesisBlock();
	private.client.cmd('sendfrom', keyPair.getAddress() + "_" + block.id, block.btc, value, function (err, tx) {
		if (err) {
			return cb(err);
		}
		cb(null, {from: keyPair.getAddress(), to: block.btc, amount: value, tx: tx});
	});
}

Bitcoin.prototype.incomingBtc = function (cb) {
	var addresses = [];

	private.client.cmd('getrawtransaction', '0611f26193654f6c064a48de9023f0fd4ed833dfb215f4e2aadef2be54922418', 1, function (err, result) {
		async.eachSeries(result.vin, function (vin, cb) {
			client.cmd('getrawtransaction', vin.txid, 1, function (err, tx) {
				addresses.push(tx['vout'][vin['vout']]['scriptPubKey']['addresses'][0]);
				cb();
			});
		}, function (err) {
			console.log(err, addresses);
		});
	});
}

Bitcoin.prototype.getTransaction = function (id, cb) {
	private.client.cmd('getrawtransaction', id, 1, cb);
}

Bitcoin.prototype.getBalanceTransactions = function (from, cb) {
	var btcTransactions = [],
		length = 0;

	if (!library.config.bitcoin.address) {
		return cb(null, btcTransactions)
	}

	async.doWhilst(function (next) {
		private.client.cmd("listtransactions", library.config.bitcoin.address, 100, from, function (err, transactions) {
			if (err) {
				return setImmediate(next, err);
			}

			var batch = [];
			for (var i in transactions) {
				if (transactions[i].confirmations < 6) {
					continue;
				}

				batch.push({
					method: "getrawtransaction",
					params: [transactions[i].txid, 1]
				})
			}

			private.client.cmd(batch, function (err, transactions) {
				if (err) {
					return setImmediate(next, err);
				}

				btcTransactions = btcTransactions.concat(transactions);
				length = transactions.length;
				from += 100;
				setImmediate(next);
			});
		});
	}, function () {
		return !!length;
	}, function (err) {
		cb(err, btcTransactions);
	});
}

Bitcoin.prototype.onBind = function (_modules) {
	modules = _modules;
}

module.exports = Bitcoin;