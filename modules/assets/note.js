var async = require('async');

var private = {}, self = null,
	library = null, modules = null;

private.unconfirmedNotes = {};

function Note(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
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
				modules.blockchain.transactions.getUnconfirmedTransactionList(function (transactions) {
					var note = transactions.find(function (tx) {
						return tx.id == query.id;
					});

					if (note.shared == 1) {
						note.title = new Buffer(note.title, 'hex').toString('utf8');
						note.data = new Buffer(note.data, 'hex').toString('utf8');
					}

					return cb(null, {
						success: true,
						note: note
					});
				});
			} else {
				var note = notes[0];

				if (note.shared == 1) {
					note.title = new Buffer(note.title, 'hex').toString('utf8');
					note.data = new Buffer(note.data, 'hex').toString('utf8');
				}

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
							console.log('title', note.title);
							modules.api.crypto.decrypt(keypair, note.title, note.nonce, function (err, result) {
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
						modules.api.crypto.decrypt(keypair, note.data, note.nonce, function (err, result) {
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