var private = {}, self = null,
	library = null, modules = null;

private.unconfirmedNotes = {};

function Note(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
}

Note.prototype.create = function (data, trs) {
	trs.data = data.data;

	if (data.title) {
		trs.title = data.title;
	}

	if (data.nonce) {
		trs.nonce = data.nonce;
	} else {
		trs.nonce = new Buffer(32);
	}

	trs.shared = data.shared;

	return trs;
}

Note.prototype.calculateFee = function (trs) {
	// calculate fee
	var fee = 10 * 100000000;
	return fee;
}

Note.prototype.verify = function (trs, sender, cb) {
	if (new Buffer(trs.data, 'hex').length > 2048) {
		return cb("Max size of encrypted data is 2048 byte, please, reduce your data");
	}

	if (trs.title && trs.title.length > 100) {
		return cb("Max size of title is 100 characters, please, reduce title");
	}

	cb(null, trs);
}

Note.prototype.process = function (trs, sender, cb) {
	setImmediate(cb, null, trs);
}

Note.prototype.getBytes = function (trs) {
	var b = Buffer.concat([new Buffer(trs.data, 'hex'), new Buffer(trs.nonce, 'hex')]);

	if (trs.title) {
		b = Buffer.concat([new Buffer(trs.title, 'hex'), b]);
	}

	return b;
}

Note.prototype.apply = function (trs, sender, cb) {
	modules.blockchain.accounts.mergeAccountAndGet({
		address: sender.address,
		balance: sender.balance - trs.fee
	}, cb);
}

Note.prototype.undo = function (trs, sender, cb) {
	modules.blockchain.accounts.undoMerging({
		address: sender.address,
		balance: sender.balance + trs.fee
	}, cb);
}

Note.prototype.applyUnconfirmed = function (trs, sender, cb) {
	if (!sender.u_balance || sender.u_balance < trs.fee) {
		return setImmediate(cb, "Sender don't have enough amount");
	}

	modules.blockchain.accounts.mergeAccountAndGet({
		address: sender.address,
		u_balance: sender.balance - trs.fee
	}, cb);
}

Note.prototype.undoUnconfirmed = function (trs, sender, cb) {
	modules.blockchain.accounts.undoMerging({
		address: sender.address,
		u_balance: sender.balance + trs.fee
	}, cb);
}

Note.prototype.save = function (trs, cb) {
	modules.api.sql.insert({
		table: "asset_notes",
		values: {
			transactionId: trs.id,
			data: trs.data,
			nonce: trs.nonce,
			shared: trs.shared,
			alias: trs.alias
		}
	}, cb);
}

Note.prototype.dbRead = function (row) {
	if (!row.n_data) {
		return null;
	}

	return {
		transactionId: row.n_transactionId,
		data: new Buffer(row.n_data).toString('hex'),
		nonce: new Buffer(row.n_nonce).toString('hex'),
		shared: row.n_shared
	};
}

Note.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAssetType(2, self);
}

Note.prototype.list = function (cb, query) {
	// list of notes
	library.validator.validate(query, {
		type: "object",
		properties: {
			publicKey: {
				type: "string",
				format: "publicKey"
			}
		}
	}, function (err) {
		if (err) {
			return cb(err[0].message);
		}

		modules.api.sql.select({
			table: "transactions",
			alias: "t",
			condition: {
				senderPublicKey: query.publicKey,
				type: 2
			},
			join: [{
				type: 'left outer',
				table: 'asset_notes',
				alias: "n",
				on: {"t.id": "n.transactionId"}
			}]
		}, ['id', 'type', 'senderId', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'signature', 'blockId', 'title', 'data', 'nonce', 'shared', 'transactionId'], function (err, notes) {
			if (err) {
				return cb(err.toString());
			}

			// get unconfirmed transactions and push to notes
			modules.blockchain.transactions.getUnconfirmedTransactionList(true, function (err, transactions) {
				if (err) {
					return cb(err.toString());
				}

				var unconfirmedNotes = transactions.filter(function (tx) {
					return tx.senderPublicKey == query.publicKey && tx.type == 2;
				});

				return cb(null, {success: true, notes: unconfirmedNotes.concat(notes)});
			});
		});
	})
}

Note.prototype.get = function (cb, query) {
	library.validator.validate(query, {
		type: "object",
		properties: {
			id: {
				type: "string",
				minLength: 1
			}
		},
		required: ["id"]
	}, function (err) {
		if (err) {
			return cb(err[0].message);
		}

		modules.api.sql.select({
			table: "transactions",
			alias: "t",
			condition: {
				id: query.id
			},
			join: [{
				type: 'left outer',
				table: 'asset_notes',
				alias: "n",
				on: {"t.id": "n.transactionId"}
			}]
		}, ['id', 'type', 'senderId', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'signature', 'blockId', 'title', 'data', 'nonce', 'shared', 'transactionId'], function (err, notes) {
			if (err) {
				return cb(err);
			}

			if (notes.length == 0) {
				modules.blockchain.transactions.getUnconfirmedTransactionList(function (transactions) {
					var note = transactions.find(function (tx) {
						return tx.id == query.id;
					});

					return cb(null, {
						success: true,
						note: note
					});
				});
			} else {
				var note = notes[0];
				return cb(null, {
					success: true,
					note: note
				});
			}
		});
	})
}

Note.prototype.decrypt = function (cb, query) {
	library.validator.validate(query, {
		type: "object",
		properties: {
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			id: {
				type: "string",
				minLength: 1
			}
		},
		required: ['secret', 'id']
	}, function (err) {
		if (err) {
			return cb(err[0].message);
		}

		var self = this,
			secret = query.secret,
			id = query.id;

		var keypair = modules.api.crypto.keypair(secret);

		modules.api.sql.select({
			table: "transactions",
			alias: "t",
			condition: {
				id: query.id
			},
			join: [{
				type: 'left outer',
				table: 'asset_notes',
				alias: "n",
				on: {"t.id": "n.transactionId"}
			}]
		}, ['id', 'type', 'senderId', 'senderPublicKey', 'recipientId', 'amount', 'fee', 'signature', 'blockId', 'title', 'data', 'nonce', 'shared', 'transactionId'], function (err, notes) {
			if (err) {
				return cb(err);
			}

			var note = notes[0];

			if (note.shared == '0') {
				async.series([
					function (cb) {
						if (note.title && note.title.length > 0) {
							modules.api.crypto.decrypt(keypair, note.title, function (err, result) {
								if (err) {
									cb(err);
								} else {
									note.title = result.decrypted;
									cb();
								}
							});
						} else {
							cb();
						}
					},
					function (cb) {
						modules.api.crypto.decrypt(keypair, note.data, function (err, result) {
							if (err) {
								cb(err);
							} else {
								note.data = result.decrypted;
								cb();
							}
						});
					}
				], function (err) {
					if (err) {
						return cb(err);
					} else {
						return cb(null, {
							success: true,
							note: note
						});
					}
				});

			} else {
				return cb("Can't decrypt note, it's already decrypted");
			}
		});
	});
}

Note.prototype.encrypt = function (cb, query) {
	library.validator.validate(query, {
		type: "object",
		properties: {
			secret: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			title: {
				type: "string",
				minLength: 1,
				maxLength: 100
			},
			data: {
				type: "string",
				minLength: 1,
				maxLength: 2000
			},
			shared: {
				type: "integer",
				minimum: 0,
				maximum: 1
			}
		},
		required: ['secret', 'data', 'shared']
	}, function (err) {
		if (err) {
			return cb(err[0].message);
		}

		var secret = query.secret,
			data = query.data,
			shared = query.shared,
			self = this;

		var transaction;
		var keypair = modules.api.crypto.keypair(secret);

		// find sender
		var account = modules.blockchain.accounts.getAccount({
			publicKey: keypair.publicKey.toString('hex')
		}, function (err, account) {
			if (err) {
				return cb(err);
			}


			if (shared) {
				try {
					transaction = library.modules.logic.transaction.create({
						type: 2,
						sender: account,
						keypair: keypair,
						data: new Buffer(data, 'utf8').toString('hex'),
						shared: shared
					});
				} catch (e) {
					return setImmediate(cb, e.toString(0));
				}

				modules.blockchain.transactions.processUnconfirmedTransaction(transaction, cb);
			} else {
				modules.api.crypto.encrypt(keypair, data, function (err, result) {
					if (err) {
						return cb(err);
					}

					try {
						transaction = library.modules.logic.transaction.create({
							type: 2,
							sender: account,
							keypair: keypair,
							nonce: result.nonce,
							data: result.encrypted,
							shared: shared
						});
					} catch (e) {
						return setImmediate(cb, e.toString(0));
					}

					modules.blockchain.transactions.processUnconfirmedTransaction(transaction, cb);
				});
			}
		});
	});

}

module.exports = Note;