var private = {}, self = null,
	library = null, modules = null;

function OutsideTransfer(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
}

OutsideTransfer.prototype.create = function (data, trs) {
	trs.recipientId = null;
	trs.amount = data.amount;

	trs.asset.outsidetransfer = {
		src_id: data.src_id
	}

	return trs;
}

OutsideTransfer.prototype.calculateFee = function (trs) {
	var fee = parseInt(trs.amount / 100 * 0.1);
	return fee || 1;
}

OutsideTransfer.prototype.verify = function (trs, sender, cb) {
	if (trs.recipientId) {
		return cb(errorCode("TRANSACTIONS.INVALID_RECIPIENT", trs));
	}

	if (trs.amount <= 0) {
		return cb(errorCode("TRANSACTIONS.INVALID_AMOUNT", trs));
	}

	cb(null, trs);
}

OutsideTransfer.prototype.getBytes = function (trs) {
	var buf;

	try {
		buf = new Buffer(trs.asset.outsidetransfer.src_id, 'utf8');
	} catch (e) {
		throw Error(e.toString());
	}

	return buf;
}

OutsideTransfer.prototype.apply = function (trs, sender, cb) {
	modules.blockchain.accounts.mergeAccountAndGet({
		address: trs.senderId,
		balance: trs.amount,
		u_balance: trs.amount
	}, cb);
}

OutsideTransfer.prototype.undo = function (trs, sender, cb) {
	modules.blockchain.accounts.undoMerging({
		address: trs.senderId,
		balance: trs.amount,
		u_balance: trs.amount
	}, cb);
}

OutsideTransfer.prototype.applyUnconfirmed = function (trs, sender, cb) {
	setImmediate(cb);
}

OutsideTransfer.prototype.undoUnconfirmed = function (trs, sender, cb) {
	setImmediate(cb);
}

OutsideTransfer.prototype.save = function (trs, cb) {
	modules.api.sql.insert({
		table: "asset_dapptransfer",
		values: {
			src_id: trs.asset.outsidetransfer.src_id,
			transactionId: trs.id
		}
	}, cb);
}

OutsideTransfer.prototype.dbRead = function (row) {
	if (!row.t_dt_src_id) {
		return null;
	}
	return {
		src_id: row.t_dt_src_id
	};
}

OutsideTransfer.prototype.onBind = function (_modules) {
	modules = _modules;

	modules.logic.transaction.attachAssetType(1, self);
}

module.exports = OutsideTransfer;
