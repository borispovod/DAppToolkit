var extend = require('extend');
var util = require('util');
var crypto = require('crypto-browserify');
var bignum = require('browserify-bignum');

var private = {}, self = null,
	library = null, modules = null;

private.accounts = [];
private.accountsIndexById = {};
private.executor = null;

function Accounts(cb, _library) {
	self = this;
	library = _library;

	cb(null, self);
}

function reverseDiff(diff) {
	var copyDiff = diff.slice();
	for (var i = 0; i < copyDiff.length; i++) {
		var math = copyDiff[i][0] == '-' ? '+' : '-';
		copyDiff[i] = math + copyDiff[i].slice(1);
	}
	return copyDiff;
}

function applyDiff(source, diff) {
	var res = source ? source.slice() : [];

	for (var i = 0; i < diff.length; i++) {
		var math = diff[i][0];
		var val = diff[i].slice(1);

		if (math == "+") {
			res = res || [];

			var index = -1;
			if (res) {
				index = res.indexOf(val);
			}
			if (index != -1) {
				return false;
			}

			res.push(val);
		}
		if (math == "-") {
			var index = -1;
			if (res) {
				index = res.indexOf(val);
			}
			if (index == -1) {
				return false;
			}
			res.splice(index, 1);
			if (!res.length) {
				res = null;
			}
		}
	}
	return res;
}

private.addAccount = function (account, scope) {
	if (!account.address) {
		account.address = self.generateAddressByPublicKey(account.publicKey);
	}
	(scope || private).accounts.push(account);
	var index = (scope || private).accounts.length - 1;
	(scope || private).accountsIndexById[account.address] = index;

	return account;
}

private.removeAccount = function (address, scope) {
	var index = (scope || private).accountsIndexById[address];
	delete (scope || private).accountsIndexById[address];
	(scope || private).accounts[index] = undefined;
}

private.getAccount = function (address, scope) {
	var index = (scope || private).accountsIndexById[address];
	return (scope || private).accounts[index];
}

Accounts.prototype.clone = function (cb) {
	cb(null, {
		data: extend(true, private.accounts),
		index: extend(true, private.accountsIndexById)
	})
}

Accounts.prototype.getExecutor = function () {
	if (!process.argv[2]) return null;
	if (private.executor) {
		return private.executor
	}
	var keypair = modules.api.crypto.keypair(process.argv[2]);
	private.executor = {
		address: self.generateAddressByPublicKey(keypair.publicKey),
		keypair: keypair,
		secret: process.argv[2]
	}

	return private.executor;
}

Accounts.prototype.generateAddressByPublicKey = function (publicKey) {
	var publicKeyHash = crypto.createHash('sha256').update(publicKey, 'hex').digest();
	var temp = new Buffer(8);
	for (var i = 0; i < 8; i++) {
		temp[i] = publicKeyHash[7 - i];
	}

	var address = bignum.fromBuffer(temp).toString() + "C";
	return address;
}

Accounts.prototype.getAccount = function (filter, cb, scope) {
	var address = filter.address;
	if (filter.publicKey) {
		address = self.generateAddressByPublicKey(filter.publicKey);
	}
	if (!address) {
		return cb("must provide address or publicKey");
	}

	cb(null, private.getAccount(address, scope));
}

Accounts.prototype.getAccounts = function (cb, scope) {
	var result = (scope || private).accounts.filter(function (el) {
		if (!el) return false;
		return true;
	})
	cb(null, result);
}

Accounts.prototype.setAccountAndGet = function (data, cb, scope) {
	var address = data.address || null;
	if (address === null) {
		if (data.publicKey) {
			address = self.generateAddressByPublicKey(data.publicKey);
		} else {
			return cb("must provide address or publicKey");
		}
	}
	var account = private.getAccount(address, scope);

	if (!account) {
		account = private.addAccount(data, scope);
	} else {
		extend(account, data);
	}

	cb(null, account);
}

Accounts.prototype.mergeAccountAndGet = function (data, cb, scope) {
	var address = data.address || null;
	if (address === null) {
		if (data.publicKey) {
			address = self.generateAddressByPublicKey(data.publicKey);
		} else {
			return cb("must provide address or publicKey");
		}
	}
	var account = private.getAccount(address, scope);

	if (!account) {
		var raw = {address: address};
		if (data.publicKey) {
			raw.publicKey = data.publicKey;
		}
		account = private.addAccount(raw, scope);
	}

	Object.keys(data).forEach(function (key) {
		var trueValue = data[key];
		if (typeof trueValue == "number") {
			account[key] = (account[key] || 0) + trueValue;
		} else if (util.isArray(trueValue)) {
			account[key] = applyDiff(account[key], trueValue);
		}
	})

	cb(null, account);
}

Accounts.prototype.undoMerging = function (data, cb, scope) {
	var address = data.address || null;
	if (address === null) {
		if (data.publicKey) {
			address = self.generateAddressByPublicKey(data.publicKey);
		} else {
			return cb("must provide address or publicKey");
		}
	}
	var account = private.getAccount(address, scope);

	if (!account) {
		var raw = {address: address};
		if (data.publicKey) {
			raw.publicKey = data.publicKey;
		}
		account = private.addAccount(raw, scope);
	}

	Object.keys(data).forEach(function (key) {
		var trueValue = data[key];
		if (typeof trueValue == "number") {
			account[key] = (account[key] || 0) - trueValue;
		} else if (util.isArray(trueValue)) {
			trueValue = reverseDiff(trueValue);
			account[key] = applyDiff(account[key], trueValue);
		}
	})

	cb(null, account);
}

Accounts.prototype.onBind = function (_modules) {
	modules = _modules;
}

Accounts.prototype.get = function (cb, query) {
	var account = private.getAccount(query.address);
	cb(null, {
		account: account
	});
}

Accounts.prototype.open = function (cb, query) {
	var keypair = modules.api.crypto.keypair(query.secret);
	var address = self.generateAddressByPublicKey(keypair.publicKey);
	var account = private.getAccount(address);

	if (!account) {
		account = private.addAccount({
			address: address,
			publicKey: keypair.publicKey.toString('hex')
		});
	}

	cb(null, {account: account});
}

module.exports = Accounts;