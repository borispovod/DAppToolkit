var extend = require("extend");
var ByteBuffer = require('bytebuffer');
var bignum = require('browserify-bignum');

var private = {}, self = null,
	library = null, modules = null;
private.types = {};

//constructor
function Transaction(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
}

//public methods
Transaction.prototype.create = function (data) {
	if (!private.types[data.type]) {
		throw Error('Unknown transaction type ' + data.type);
	}

	if (!data.sender) {
		throw Error("Can't find sender");
	}

	if (!data.keypair) {
		throw Error("Can't find keypair");
	}

	var trs = {
		type: data.type,
		amount: 0,
		senderId: data.sender.address,
		senderPublicKey: data.sender.publicKey,
		asset: {}
	};

	trs = private.types[trs.type].create.call(self, data, trs);

	var trsBytes = self.getBytes(trs);
	trs.signature = modules.api.crypto.sign(data.keypair, trsBytes);

	var trsBytes = self.getBytes(trs);
	trs.id = modules.api.crypto.getId(trsBytes);

	trs.fee = private.types[trs.type].calculateFee.call(self, trs);

	return trs;
}

Transaction.prototype.attachAssetType = function (typeId, instance) {
	if (instance && typeof instance.create == 'function' && typeof instance.getBytes == 'function' &&
		typeof instance.calculateFee == 'function' && typeof instance.verify == 'function' &&
		typeof instance.apply == 'function' && typeof instance.undo == 'function' &&
		typeof instance.applyUnconfirmed == 'function' && typeof instance.undoUnconfirmed == 'function' &&
		typeof instance.save == 'function' && typeof instance.dbRead == 'function'
	) {
		private.types[typeId] = instance;
	} else {
		throw Error('Invalid instance interface');
	}
}

Transaction.prototype.getBytes = function (trs, skipSignature) {
	if (!private.types[trs.type]) {
		throw Error('Unknown transaction type ' + trs.type);
	}

	try {
		var assetBytes = private.types[trs.type].getBytes.call(self, trs, skipSignature);
		var assetSize = assetBytes ? assetBytes.length : 0;

		var bb = new ByteBuffer(1 + 32 + 8 + 8 + 64 + 64 + assetSize, true);
		bb.writeByte(trs.type);

		var senderPublicKeyBuffer = new Buffer(trs.senderPublicKey, 'hex');
		for (var i = 0; i < senderPublicKeyBuffer.length; i++) {
			bb.writeByte(senderPublicKeyBuffer[i]);
		}

		if (trs.recipientId) {
			var recipient = trs.recipientId.slice(0, -1);
			recipient = bignum(recipient).toBuffer({size: 8});

			for (var i = 0; i < 8; i++) {
				bb.writeByte(recipient[i] || 0);
			}
		} else {
			for (var i = 0; i < 8; i++) {
				bb.writeByte(0);
			}
		}

		bb.writeLong(trs.amount);

		if (assetSize > 0) {
			for (var i = 0; i < assetSize; i++) {
				bb.writeByte(assetBytes[i]);
			}
		}

		if (!skipSignature && trs.signature) {
			var signatureBuffer = new Buffer(trs.signature, 'hex');
			for (var i = 0; i < signatureBuffer.length; i++) {
				bb.writeByte(signatureBuffer[i]);
			}
		}

		bb.flip();
	} catch (e) {
		throw Error(e.toString());
	}
	return bb.toBuffer();
}

Transaction.prototype.process = function (trs, sender, cb) {
	if (!private.types[trs.type]) {
		return setImmediate(cb, 'Unknown transaction type ' + trs.type);
	}

	try {
		var trsBytes = self.getBytes(trs);
		var txId = modules.api.crypto.getId(trsBytes);
	} catch (e) {
		return setImmediate(cb, "Can't get transaction id");
	}
	if (trs.id && trs.id != txId) {
		return setImmediate(cb, "Invalid transaction id");
	} else {
		trs.id = txId;
	}

	modules.api.transactions.getTransaction(trs.id, function (err, data) {
		if (err != "Transaction not found") {
			return cb("Can't process transaction, transaction already confirmed");
		}

		cb(null, trs);
	});
}

Transaction.prototype.verifySignature = function (trs, publicKey, signature) {
	if (!private.types[trs.type]) {
		throw Error('Unknown transaction type ' + trs.type);
	}

	if (!signature) return false;

	try {
		var bytes = self.getBytes(trs, true);
		var res = modules.api.crypto.verify(publicKey, signature, bytes);
	} catch (e) {
		throw Error(e.toString());
	}

	return res;
}

Transaction.prototype.verify = function (trs, sender, cb) { //inheritance
	if (!private.types[trs.type]) {
		return setImmediate(cb, 'Unknown transaction type ' + trs.type);
	}

	//check sender
	if (!sender) {
		return setImmediate(cb, "Can't find sender");
	}

	//verify signature
	try {
		var valid = self.verifySignature(trs, trs.senderPublicKey, trs.signature);
	} catch (e) {
		return setImmediate(cb, e.toString());
	}
	if (!valid) {
		return setImmediate(cb, "Can't verify transaction signature");
	}

	//check sender
	if (trs.senderId != sender.address) {
		return setImmediate(cb, "Invalid sender id: " + trs.id);
	}

	//calc fee
	var fee = private.types[trs.type].calculateFee.call(self, trs);
	if (fee === false || fee === undefined || trs.fee != fee) {
		return setImmediate(cb, "Invalid transaction type/fee: " + trs.id);
	}
	//check amount
	if (trs.amount < 0 || trs.amount > 100000000 * Math.pow(10, 8) || String(trs.amount).indexOf('.') >= 0 || trs.amount.toString().indexOf('e') >= 0) {
		return setImmediate(cb, "Invalid transaction amount: " + trs.id);
	}

	//spec
	private.types[trs.type].verify.call(self, trs, sender, cb);
}

Transaction.prototype.apply = function (trs, sender, cb) {
	if (!private.types[trs.type]) {
		return setImmediate(cb, 'Unknown transaction type ' + trs.type);
	}

	private.types[trs.type].apply.call(self, trs, sender, cb);
}

Transaction.prototype.undo = function (trs, sender, cb) {
	if (!private.types[trs.type]) {
		return setImmediate(cb, 'Unknown transaction type ' + trs.type);
	}

	private.types[trs.type].undo.call(self, trs, sender, cb);
}

Transaction.prototype.applyUnconfirmed = function (trs, sender, cb) {
	if (!private.types[trs.type]) {
		return setImmediate(cb, 'Unknown transaction type ' + trs.type);
	}

	private.types[trs.type].applyUnconfirmed.call(self, trs, sender, cb);
}

Transaction.prototype.undoUnconfirmed = function (trs, sender, cb) {
	if (!private.types[trs.type]) {
		return setImmediate(cb, 'Unknown transaction type ' + trs.type);
	}

	private.types[trs.type].undoUnconfirmed.call(self, trs, sender, cb);
}

Transaction.prototype.save = function (trs, cb) {
	if (!private.types[trs.type]) {
		return cb('Unknown transaction type ' + trs.type);
	}

	modules.api.sql.insert({
		table: "transactions",
		values: {
			id: trs.id,
			type: trs.type,
			senderId: trs.senderId,
			senderPublicKey: trs.senderPublicKey,
			recipientId: trs.recipientId,
			amount: trs.amount,
			fee: trs.fee,
			signature: trs.signature,
			blockId: trs.blockId
		}
	}, function (err) {
		if (err) {
			return cb(err);
		}
		private.types[trs.type].save.call(this, trs, cb);
	});
}

Transaction.prototype.dbRead = function (row) {
	if (!row.t_id) {
		return null;
	}

	var trs = {
		id: row.t_id,
		type: row.t_type,
		senderId: row.t_senderId,
		senderPublicKey: row.t_senderPublicKey,
		recipientId: row.t_recipientId,
		amount: row.t_amount,
		fee: row.t_fee,
		signature: row.t_signature,
		blockId: row.t_blockId,
		asset: {}
	};

	if (!private.types[trs.type]) {
		return cb('Unknown transaction type ' + trs.type);
	}

	var asset = private.types[trs.type].dbRead(row);
	if (asset) {
		trs.asset = extend(trs.asset, asset);
	}

	return trs;
}

Transaction.prototype.onBind = function (_modules) {
	modules = _modules;
}

//export
module.exports = Transaction;