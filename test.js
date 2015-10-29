var b = require('bitcoin');
var bitcoin = require('bitcoinjs-lib');
var bigi = require('bigi');
var async = require('async');
var ByteBuffer = require('bytebuffer');

var private = {};

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

private.client = new b.Client({
	"host": "localhost",
	"port": 18332,
	"user": "bitcoin",
	"pass": "root",
	"timeout": 30000
});

private.makePair = function (secret) {
	var hash = bitcoin.crypto.sha256(secret);
	var d = bigi.fromBuffer(hash);
	var keyPair = new bitcoin.ECPair(d, undefined, {
		compressed: false,
		network: private.network
	});

	return keyPair;
}

private.createAddress = function (secret, cb) {
	var keyPair = private.makePair(secret);
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
			private.client.cmd('setaccount', keyPair.getAddress(), keyPair.getAddress() + "_" + 10497276715228427758, cb);
		}
	], function (err) {
		if (err && err != "Account exists") {
			return cb(err);
		}
		cb(null, {address: keyPair.getAddress(), account: keyPair.getAddress() + "_" + 10497276715228427758});
	});
}

private.getBalance = function (secret, cb) {
	var keyPair = private.makePair(secret);
	private.client.cmd('getbalance', keyPair.getAddress() + "_" + 10497276715228427758, function (err, balance) {
		if (err) {
			return cb(err);
		}
		cb(null, {address: keyPair.getAddress(), balance: balance});
	});
}

private.createDepositTransfer = function (secret, address, cb) {
	var keyPair = private.makePair(secret);
	private.unspendByAddress(keyPair.getAddress(), function (err, transactions) {
		if (err) {
			return cb(err)
		}
		if (!transactions.length) {
			return cb("has no unspend transactions")
		}
		var data = new Buffer(keyPair.getAddress() + ":" + 10497276715228427758)
		var totalAmount = 0;

		var tx = new bitcoin.TransactionBuilder(private.network)
		for (var i = 0; i < transactions.length; i++) {
			totalAmount += transactions[i].amount;
			tx.addInput(transactions[i].txid, transactions[i].vout);
		}
		var normal_fee = 0.0005;
		var fee = normal_fee / (1 - (tx.tx.byteLength() / 1024) / 500);
		var amount = totalAmount * 100000000 - Math.ceil(fee * 100000000);
		tx.addOutput(address, amount);

		var dataScript = bitcoin.script.nullDataOutput(data);
		tx.addOutput(dataScript, 0);
		for (var i = 0; i < transactions.length; i++) {
			tx.sign(i, keyPair);
		}

		cb(null, {from: keyPair.getAddress(), to: address, amount: amount, tx: tx.build()});
	});
}

private.sendTransaction = function (rawtx, cb) {
	private.client.cmd('sendrawtransaction', rawtx, function (err, data) {
		if (err) {
			return cb(err);
		}
		cb(null, {tx: data});
	});
}

private.unspendByAddress = function (address, cb) {
	private.client.cmd('listunspent', function (err, result) {
		if (err) {
			return cb(err);
		}
		var txs = result.filter(function (tx) {
			return tx.address == address;
		});
		cb(null, txs);
	});
}

var user1Address = null;
var authorAddress = null;
var tx = null;

async.series([
	function (cb) {
		private.createAddress("user1", function (err, data) {
			console.log("createAddress 'user1'", err, data)
			if (!err) {
				user1Address = data.address;
			}
			cb(err, data)
		})
	},
	function (cb) {
		private.createAddress("dapp_author", function (err, data) {
			console.log("createAddress 'dapp_author'", err, data)
			if (!err) {
				authorAddress = data.address;
			}
			cb(err, data)
		})
	},
	function (cb) {
		private.getBalance("user1", function (err, data) {
			console.log("getBalance 'user1'", err, data)
			cb(err, data)
		})
	},
	function (cb) {
		private.getBalance("dapp_author", function (err, data) {
			console.log("getBalance 'dapp_author'", err, data)
			cb(err, data)
		})
	},
	function (cb) {
		private.createDepositTransfer("user1", authorAddress, function (err, data) {
			console.log("createDepositTransfer", err, data)
			if (!err) {
				tx = data.tx;
			}
			cb(err, data)
		})
	},
	function (cb) {
		private.sendTransaction(tx.toHex(), function (err, data) {
			console.log("sendTransaction", err, data)
			cb(err, data)
		})
	}
	//function (cb) {
	//	private.depositTransfer("user1", authorAddress, 1.1, function (err, data) {
	//		console.log("depositTransfer user1 to dapp_author 1.1", err, data)
	//		if (!err) {
	//			tx = data.tx;
	//		}
	//		cb(err, data)
	//	})
	//},
	//function (cb) {
	//	private.incomingBtc(tx, function (err, data) {
	//		console.log("incomingBtc", err, data)
	//		cb(err, data)
	//	})
	//}
], function () {

})
