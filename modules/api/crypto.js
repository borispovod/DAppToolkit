var ed2curve = require('ed2curve');
var nacl_factory = require('js-nacl');
var crypto = require('crypto-browserify');
var bignum = require('browserify-bignum');

var nacl = nacl_factory.instantiate();

var private = {}, self = null,
	library = null, modules = null;

function Crypto(cb, _library) {
	self = this;
	library = _library;
	cb(null, self);
}


private.convertPublicKey = function (publicKey) {
	return ed2curve.convertPublicKey(publicKey)
}

private.convertPrivateKey = function (privateKey) {
	return ed2curve.convertSecretKey(privateKey);
}

private.encrypt = function (message, nonce, senderPrivateKey, recipientPublicKey) {
	return nacl.crypto_box(message, nonce, private.convertPublicKey(recipientPublicKey), private.convertPrivateKey(senderPrivateKey));
}

private.decrypt = function (message, nonce, senderPublicKey, recipientPrivateKey) {
	return nacl.crypto_box_open(message, nonce, private.convertPublicKey(senderPublicKey), private.convertPrivateKey(recipientPrivateKey));
}

private.getNonce = function () {
	return nacl.crypto_box_random_nonce();;
}

private.cryptobox = function (text, nonce, key) {
	return nacl.crypto_secretbox(nacl.encode_utf8(text), nonce, private.convertPrivateKey(key));
}

private.decrypt_cryptobox = function (text, nonce, key) {
	return nacl.crypto_secretbox_open(text, nonce, private.convertPrivateKey(key));
}

Crypto.prototype.encrypt = function (keypair, text, nonce, cb) {
	if (typeof nonce == 'function') {
		cb = nonce;
		nonce = null;
	}

	if (!nonce) {
		nonce = private.getNonce();
	} else {
		nonce = new Buffer(nonce, 'hex');
	}

	var encrypted = private.cryptobox(text, nonce, keypair.privateKey);

	return cb(null, {
		nonce: new Buffer(nonce).toString('hex'),
		encrypted: new Buffer(encrypted).toString('hex')
	});
}

Crypto.prototype.decrypt = function (keypair, encrypted, nonce, cb) {
	var decrypted = private.decrypt_cryptobox(new Buffer(encrypted, 'hex'), new Buffer(nonce, 'hex'), keypair.privateKey);

	return cb(null, {
		decrypted: new Buffer(decrypted).toString('utf8')
	});
}

Crypto.prototype.keypair = function (secret) {
	var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();
	var kp = nacl.crypto_sign_keypair_from_seed(hash);

	var keypair = {
		publicKey: new Buffer(kp.signPk).toString('hex'),
		privateKey: new Buffer(kp.signSk).toString('hex')
	}

	return keypair;
}

Crypto.prototype.sign = function (keypair, data) {
	var hash = crypto.createHash('sha256').update(data).digest();
	var signature = nacl.crypto_sign_detached(hash, new Buffer(keypair.privateKey, 'hex'));
	return new Buffer(signature).toString('hex');
}

Crypto.prototype.verify = function (publicKey, signature, data) {
	var hash = crypto.createHash('sha256').update(data).digest();
	var signatureBuffer = new Buffer(signature, 'hex');
	var senderPublicKeyBuffer = new Buffer(publicKey, 'hex');
	return nacl.crypto_sign_verify_detached(signatureBuffer, hash, senderPublicKeyBuffer);
}

Crypto.prototype.getId = function (data) {
	var hash = crypto.createHash('sha256').update(data).digest();
	var temp = new Buffer(8);
	for (var i = 0; i < 8; i++) {
		temp[i] = hash[7 - i];
	}

	var id = bignum.fromBuffer(temp).toString();
	return id;
}

Crypto.prototype.onBind = function (_modules) {
	modules = _modules;
}

module.exports = Crypto;