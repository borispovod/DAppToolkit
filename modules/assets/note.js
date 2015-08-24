var private = {}, self = null,
	library = null, modules = null;

function Note(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
}

Note.prototype.create = function (data, trs) {
	trs.data = data.encrypted;
	trs.nonce = data.nonce;
	trs.shared = data.shared;

	return trs;
}

Note.prototype.calculateFee = function (trs) {
	var fee = 1;
	return fee;
}

Note.prototype.verify = function (trs, sender, cb) {
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
	setImmediate(cb);
}

Note.prototype.dbRead = function (row) {
	return null;
}

Note.prototype.onBind = function (_modules) {
	modules = _modules;
	modules.logic.transaction.attachAssetType(2, self);
}

module.exports = Note;