var async = require('async');

var private = {}, self = null,
	library = null, modules = null;

private.unconfirmedNotes = {};

function Note(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
}

private.normalize = function (tx) {
	console.log(tx);
	tx.asset = {
		note: {
			data: tx.data,
			title: tx.title,
			shared: tx.shared,
			nonce: tx.nonce
		}
	}

	delete tx.data;
	delete tx.title;
	delete tx.shared;
	delete tx.nonce;
}

Note.prototype.create = function (data, trs) {
	trs.asset = {
		note: {
			data: data.data
		}
	};

	if (data.title) {
		trs.asset.note.title = data.title;
	}

	if (data.nonce) {
		trs.asset.note.nonce = data.nonce;
	} else {
		trs.asset.note.nonce = new Buffer(32).toString('hex');
	}

	trs.asset.note.shared = data.shared;

	return trs;
}

Note.prototype.calculateFee = function (trs) {
	// calculate fee
	var fee = 10 * 100000000;
	return fee;
}

Note.prototype.verify = function (trs, sender, cb) {
	if (trs.asset.note.data.length > 2048) {
		return cb("Max size of encrypted data is 2048 byte, please, reduce your data");
	}

	if (trs.asset.note.title && trs.asset.note.title.length > 100) {
		return cb("Max size of title is 100 characters, please, reduce title");
	}

	cb(null, trs);
}

Note.prototype.process = function (trs, sender, cb) {
	setImmediate(cb, null, trs);
}

Note.prototype.getBytes = function (trs) {
	var b = Buffer.concat([new Buffer(trs.asset.note.data, 'hex'), new Buffer(trs.asset.note.nonce, 'hex')]);

	if (trs.asset.note.title && trs.asset.note.title.length > 0) {
		b = Buffer.concat([new Buffer(trs.asset.note.title, 'hex'), b]);
	}

	return b;
}

Note.prototype.apply = function (trs, sender, cb) {
	modules.blockchain.accounts.mergeAccountAndGet({
		address: sender.address,
		balance: -trs.fee
	}, cb);
}

Note.prototype.undo = function (trs, sender, cb) {
	modules.blockchain.accounts.undoMerging({
		address: sender.address,
		balance: trs.fee
	}, cb);
}

Note.prototype.applyUnconfirmed = function (trs, sender, cb) {
	if (!sender.u_balance || sender.u_balance < trs.fee) {
		return setImmediate(cb, "Sender don't have enough amount");
	}

	modules.blockchain.accounts.mergeAccountAndGet({
		address: sender.address,
		u_balance: -trs.fee
	}, cb);
}

Note.prototype.undoUnconfirmed = function (trs, sender, cb) {
	modules.blockchain.accounts.undoMerging({
		address: sender.address,
		u_balance: trs.fee
	}, cb);
}

Note.prototype.save = function (trs, cb) {
	modules.api.sql.insert({
		table: "asset_notes",
		values: {
			transactionId: trs.id,
			data: trs.asset.note.data,
			title: trs.asset.note.title,
			nonce: trs.asset.note.nonce,
			shared: trs.asset.note.shared
		}
	}, cb);
}

Note.prototype.dbRead = function (row) {
	if (!row.n_data) {
		return null;
	}

	return {
		note: {
			data: row.n_data,
			title: row.n_title,
			nonce: row.n_nonce,
			shared: parseInt(row.n_shared)
		}
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

			for (var i in notes) {
				private.normalize(notes[i]);
			}

			// get unconfirmed transactions and push to notes
			modules.blockchain.transactions.getUnconfirmedTransactionList(true, function (err, transactions) {
				if (err) {
					return cb(err.toString());
				}

				var unconfirmedNotes = transactions.filter(function (tx) {
					return tx.senderPublicKey == query.publicKey && tx.type == 2;
				});

				for (var i in unconfirmedNotes) {
					if (unconfirmedNotes[i].shared == 1 && unconfirmedNotes[i].title && unconfirmedNotes[i].title.length > 0) {
						unconfirmedNotes[i].title = new Buffer(unconfirmedNotes[i].title, 'hex').toString('utf8');
					}
				}
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
				modules.blockchain.transactions.getUnconfirmedTransactionList(false, function (err, transactions) {
					var tx = transactions.filter(function (tx) {
						return tx.id == query.id;
					});

					if (tx.length > 0) {
						tx = tx[0];
						if (tx.asset.note.shared == 1) {
							tx.asset.note.title = new Buffer(tx.asset.note.title, 'hex').toString('utf8');
							tx.asset.note.data = new Buffer(tx.asset.note.data, 'hex').toString('utf8');
						}

						return cb(null, {
							success: true,
							note: tx
						});
					} else {
						return cb("Note not found");
					}
				});
			} else {
				var tx = notes[0];
				private.normalize(tx);

				if (tx.asset.note.shared == 1) {
					tx.asset.note.title = new Buffer(tx.asset.note.title, 'hex').toString('utf8');
					tx.asset.note.data = new Buffer(tx.asset.note.data, 'hex').toString('utf8');
				}

				return cb(null, {
					success: true,
					note: tx
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
			nonce: {
				type: "string",
				minLength: 1
			}
		},
		required: ['secret', 'data', 'nonce']
	}, function (err) {
		if (err) {
			return cb(err[0].message);
		}

		var self = this,
			secret = query.secret,
			data = query.data,
			title = query.title,
			nonce = query.nonce;

		var keypair = modules.api.crypto.keypair(secret);
		var result = {};

		async.series([
			function (cb) {
				if (title) {
					modules.api.crypto.decrypt(keypair, title, nonce, function (err, data) {
						if (err) {
							return cb(err);
						} else {
							result.title = data.decrypted;
							cb();
						}
					});
				}
			},
			function (cb) {
				modules.api.crypto.decrypt(keypair, data, nonce, function (err, data) {
					if (err) {
						return cb(err);
					} else {
						result.data = data.decrypted;
						cb();
					}
				});
			}
		], function (err) {
			if (err) {
				return cb(err);
			}

			return cb(null, {
				success: true,
				note: result
			});
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
			title = query.title,
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
						title: new Buffer(title, 'utf8').toString('hex'),
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
				modules.api.crypto.encrypt(keypair, data, function (err, data_encrypted) {
					if (err) {
						return cb(err);
					}

					modules.api.crypto.encrypt(keypair, title, data_encrypted.nonce, function (err, title_encrypted) {
						if (err) {
							return cb(err);
						}

						try {
							transaction = library.modules.logic.transaction.create({
								type: 2,
								title: title_encrypted.encrypted,
								sender: account,
								keypair: keypair,
								nonce: data_encrypted.nonce,
								data: data_encrypted.encrypted,
								shared: shared
							});
						} catch (e) {
							return setImmediate(cb, e.toString(0));
						}

						modules.blockchain.transactions.processUnconfirmedTransaction(transaction, cb);
					});
				});
			}
		});
	});

}

module.exports = Note;