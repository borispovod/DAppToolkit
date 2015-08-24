var private = {}, self = null,
	library = null, modules = null;

function Note(cb, _library) {
	self = this;
	self.type = 2;
	library = _library;
	cb(null, self);
}

Note.prototype.create = function (data, trs) {
	trs.data = data.data;
	trs.nonce = data.nonce;
	trs.shared = data.shared;

	return trs;
}

Note.prototype.calculateFee = function (trs) {
	// calculate fee
	var fee = 1;
	return fee;
}

Note.prototype.verify = function (trs, sender, cb) {
	if (new Buffer(trs.data, 'hex').length > 160) {
		return cb("Max size of encrypted data is 160 byte, please, reduce your data");
	}

	cb(null, trs);
}

Note.prototype.process = function (trs, sender, cb) {
	setImmediate(cb, null, trs);
}

Note.prototype.getBytes = function (trs) {
	return Buffer.concat([new Buffer(trs.data, 'hex'), new Buffer(trs.nonce, 'hex')]);
}

Note.prototype.apply = function (trs, sender, cb) {
	setImmediate(cb);
}

Note.prototype.undo = function (trs, sender, cb) {
	setImmediate(cb);
}

Note.prototype.applyUnconfirmed = function (trs, sender, cb) {
	setImmediate(cb);
}

Note.prototype.undoUnconfirmed = function (trs, sender, cb) {
	setImmediate(cb);
}

Note.prototype.save = function (cb) {
	// how to save???
	setImmediate(cb);
}

Note.prototype.dbRead = function (row) {
	// how to read???
	return null;
}

Note.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAssetType(self.type, self);
}

Note.prototype.encrypt = function (query, cb) {
	var secret = query.secret,
		data = query.data,
		shared = query.shared,
		self = this;

	var transaction;
	var keypair = modules.api.crypto.keypair(secret);

	// find sender
	var account = modules.accounts.getAccount(modules.accounts.generateAddressByPublicKey(keypair.publicKey.toString('hex')));

	if (shared) {
		transaction = library.logic.transaction.create({
			type: self.type,
			sender: account,
			keypair: keypair,
			data: new Buffer(data, 'utf8').toString('hex'),
			shared: shared
		});
	} else {
		modules.api.crypto.encrypt(keypair, data, function (err, result) {
			if (err) {
				return cb(err);
			}

			transaction = library.logic.transaction.create({
				type: self.type,
				sender: account,
				keypair: keypair,
				data: result.data,
				shared: shared
			});
		});
	}
}

module.exports = Note;