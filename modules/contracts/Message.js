var private = {}, self = null,
	library = null, modules = null;

function Message(cb, _library) {
	self = this;
	self.type = 6
	library = _library;
	cb(null, self);
}

Message.prototype.create = function (data, trs) {
	// Create asset object
	trs.asset = {
		message: new Buffer(data.message, 'utf8').toString('hex') //save message as hex string
	};

	return trs;
}

Message.prototype.calculateFee = function (trs) {
	return 1 * Math.pow(10, 8);
}

Message.prototype.verify = function (trs, sender, cb, scope) {
	if (trs.asset.message.length > 320) {
		return setImmediate(cb, "Max length of message is 320 characters");
	}

	setImmediate(cb, null, trs);
}

Message.prototype.getBytes = function (trs) {
	return new Buffer(trs.asset.message, 'hex');
}

Message.prototype.apply = function (trs, sender, cb, scope) {
	modules.blockchain.accounts.mergeAccountAndGet({
		address: sender.address,
		balance: -trs.fee
	}, cb);
}

Message.prototype.undo = function (trs, sender, cb, scope) {
	modules.blockchain.accounts.undoMerging({
		address: sender.address,
		balance: -trs.fee
	}, cb);
}

Message.prototype.applyUnconfirmed = function (trs, sender, cb, scope) {
	if (sender.u_balance < trs.fee) {
		return setImmediate(cb, "Sender don't have enough amount");
	}

	modules.blockchain.accounts.mergeAccountAndGet({
		address: sender.address,
		u_balance: -trs.fee
	}, cb);
}

Message.prototype.undoUnconfirmed = function (trs, sender, cb, scope) {
	modules.blockchain.accounts.undoMerging({
		address: sender.address,
		u_balance: -trs.fee
	}, cb);
}

Message.prototype.ready = function (trs, sender, cb, scope) {
	setImmediate(cb);
}

Message.prototype.save = function (trs, cb) {
	modules.api.sql.insert({
		table: "asset_messages",
		values: {
			transactionId: trs.id,
			message: trs.asset.message
		}
	}, cb);
}

Message.prototype.dbRead = function (row) {
	if (!row.tm_transactionId) {
		return null;
	} else {
		return {
			message: row.tm_message
		};
	}
}

Message.prototype.normalize = function (asset, cb) {
	library.validator.validate(asset, {
		type: "object", // it's object
		properties: {
			message: { // it's contains property message
				type: "string", // it's string
				format: "hex",  // validate to hex
				minLength: 1 // minimum length of string is 1 character
			}
		},
		required: ["message"] // message property is required and can't be missed
	}, cb);
}

Message.prototype.add = function (cb, query) {
	library.validator.validate(query, {
		type: "object",
		properties: {
			recipientId: {
				type: "string",
				minLength: 2,
				maxLength: 21
			},
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			message: {
				type: "string",
				minLength: 1,
				maxLength: 160
			}
		}
	}, function (err) {
		if (err) {
			return cb(err[0].message);
		}

		var keypair = modules.api.crypto.keypair(query.secret);
		modules.blockchain.accounts.getAccount({
			publicKey: keypair.publicKey.toString('hex')
		}, function (err, account) {
			// if error happened, call cb with error argument
			if (err) {
				return cb(err);
			}

			try {
				var transaction = library.modules.logic.transaction.create({
					type: self.type,
					message: query.message,
					recipientId: query.recipientId,
					sender: account,
					keypair: keypair,
				});
			} catch (e) {
				return setImmediate(cb, e.toString());
			}

			modules.blockchain.transactions.processUnconfirmedTransaction(transaction, cb);
		});
	});
}

Message.prototype.list = function (cb, query) {
	// verify query parameters
	library.validator.validate(query, {
		type: "object",
		properties: {
			recipientId: {
				type: "string",
				minLength: 2,
				maxLength: 21
			}
		},
		required: ["recipientId"]
	}, function (err) {
		if (err) {
			return cb(err[0].message);
		}

		// select from table transactions and join messages from table asset_messages
		modules.api.sql.select({
			table: "transactions",
			alias: "t",
			condition: {
				recipientId: query.recipientId,
				type: self.type
			},
			join: [{
				type: 'left outer',
				table: 'asset_messages',
				alias: "tm",
				on: {"t.id": "tm.transactionId"}
			}]
		}, ['id', 'type', 'senderId', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'signature', 'blockId', 'message'], function (err, transactions) {
			if (err) {
				return cb(err.toString());
			}

			// map results to asset object
			var messages = transactions.map(function (tx) {
				tx.asset = {
					message: tx.message
				};

				delete tx.message;
			});

			return cb(null, {
				messages: messages
			})
		});
	});
}

Message.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAssetType(self.type, self);
}

module.exports = Message;