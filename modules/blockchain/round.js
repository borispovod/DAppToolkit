var async = require('async');
var crypto = require('crypto-browserify');

var private = {}, self = null,
	library = null, modules = null;
private.delegates = [];
private.loaded = false;

function Round(cb, _library) {
	self = this;
	library = _library;

	cb(null, self);
}

private.loop = function (point, cb) {
	var executor = modules.blockchain.accounts.getExecutor();
	if (!executor.address) {
		library.logger('loop', 'exit: secret doesn´t found');
		return cb();
	}

	library.sequence.add(function (cb) {
		var currentDelegate = private.getState(executor, point.height);

		if (currentDelegate) {
			modules.blockchain.blocks.createBlock(executor, point, cb);
		} else {
			cb("skip slot: another delegate");
		}

	}, function (err) {
		if (err) {
			library.logger("Problem in block generation", err);
		}
		cb(err)
	})
}

private.getState = function (executor, height) {
	var delegates = self.generateDelegateList(height);

	var currentSlot = height;
	var lastSlot = currentSlot + delegates.length;

	for (; currentSlot < lastSlot; currentSlot += 1) {
		var delegate_pos = currentSlot % delegates.length;

		var delegate_id = delegates[delegate_pos];

		if (delegate_id && executor.address == delegate_id) {
			return executor;
		}
	}
	return null;
}

Round.prototype.calc = function (height) {
	return Math.floor(height / private.delegates.length) + (height % private.delegates.length > 0 ? 1 : 0);
}

Round.prototype.generateDelegateList = function (height) {
	var seedSource = self.calc(height).toString();

	var delegates = private.delegates.slice(0);

	var currentSeed = crypto.createHash('sha256').update(seedSource, 'utf8').digest();
	for (var i = 0, delCount = delegates.length; i < delCount; i++) {
		for (var x = 0; x < 4 && i < delCount; i++, x++) {
			var newIndex = currentSeed[x] % delCount;
			var b = delegates[newIndex];
			delegates[newIndex] = delegates[i];
			delegates[i] = b;
		}
		currentSeed = crypto.createHash('sha256').update(currentSeed).digest();
	}

	return delegates;
}

Round.prototype.onBind = function (_modules) {
	modules = _modules;
}

Round.prototype.onBlockchainLoaded = function () {
	var genesisBlock = modules.blockchain.blocks.genesisBlock();
	//private.delegates = genesisBlock.associate;
	private.delegates.push(modules.blockchain.accounts.generateAddressByPublicKey(genesisBlock.delegate));
	private.delegates.sort();

	private.loaded = true;
}

Round.prototype.onMessage = function (query) {
	if (query.topic == "point" && private.loaded) {
		var blockId = query.message;
		private.loop(blockId, function (err) {
			console.log("loop", err)
		});
	}
}

module.exports = Round;