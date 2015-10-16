var bitcoin = require('bitcoin');

var private = {}, self = null,
	library = null, modules = null;

function Bitcoin(cb, _library) {
	self = this;
	library = _library;

	private.client = new bitcoin(library.config.bitcoin.config);
	cb(null, self);
}


Bitcoin.prototype.getBalanceTransactions = function (from, cb) {
	var btcTransactions = [],
		length = 0;

	async.doWhilst(function (next) {
		client.cmd("listtransactions", library.config.bitcoin.address, 100, from, function (err, transactions) {
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
			};

			client.cmd(batch, function (err, transactions) {
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