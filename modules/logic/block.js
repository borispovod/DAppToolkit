var ByteBuffer = require('bytebuffer');
var crypto = require('crypto-browserify');
var bignum = require('browserify-bignum');

var private = {}, self = null,
	library = null, modules = null;
private.types = {};

//constructor
function Block(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
}

//public methods
Block.prototype.getBytes = function (block, withSignature) {
	var pb, i, size = 32 + 8 + 4 + 4;

	if (withSignature && block.signature) {
		size = size + 64;
	}

	var bb = new ByteBuffer(size, true);

	pb = new Buffer(block.delegate, 'hex');
	for (i = 0; i < pb.length; i++) {
		bb.writeByte(pb[i]);
	}

	pb = bignum(block.pointId).toBuffer({size: '8'});
	for (i = 0; i < 8; i++) {
		bb.writeByte(pb[i]);
	}

	bb.writeInt(block.pointHeight);

	bb.writeInt(block.count);

	if (withSignature && block.signature) {
		pb = new Buffer(block.signature, 'hex');
		for (i = 0; i < pb.length; i++) {
			bb.writeByte(pb[i]);
		}
	}

	bb.flip();
	var b = bb.toBuffer();

	return b;
}

Block.prototype.verifySignature = function (block) {
	var blockBytes = self.getBytes(block);
	if (block.id !==  modules.api.crypto.getId(blockBytes)) {
		return false;
	}
	if (!modules.api.crypto.verify(block.delegate, block.signature, blockBytes)) {
		return false;
	}

	return true;
}

Block.prototype.save = function (block, cb) {
	modules.api.sql.insert({
		table: "blocks",
		values: {
			id: block.id,
			pointId: block.pointId,
			pointHeight: block.pointHeight,
			delegate: block.delegate,
			signature: block.signature,
			count: block.count
		}
	}, function (err) {
		if (!err) {
			private.lastBlock = block;
			modules.api.transport.message("block", block, cb);
		} else {
			setImmediate(cb);
		}
	});
}

Block.prototype.dbRead = function (row) {
	return {
		id: row.b_id,
		pointId: row.b_pointId,
		pointHeight: row.b_pointHeight,
		delegate: row.b_delegate,
		signature: row.b_signature,
		count: row.b_count
	};
}

Block.prototype.onBind = function (_modules) {
	modules = _modules;
}

//export
module.exports = Block;
