var bitcoin = require('bitcoin');
var async = require('async');

var private = {}, self = null,
	library = null, modules = null;

function Bitcoin(cb, _library) {
	self = this;
	library = _library;

	private.client = new bitcoin.Client(library.config.bitcoin.config);
	cb(null, self);
}

Bitcoin.prototype.getTransaction = function (id, cb) {
	private.client.cmd('getrawtransaction', id, 1, cb);
}

Bitcoin.prototype.getBalanceTransactions = function (from, cb) {
	var btcTransactions = [],
		length = 0;

	if (!library.config.bitcoin.address){
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