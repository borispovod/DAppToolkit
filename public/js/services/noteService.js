angular.module('encryptiApp').service('noteService', ['$http', 'idFactory', 'userService', function ($http, idFactory, userService) {
	function saveNote(note, cb) {
		$http.post('/api/dapps/' + idFactory + '/api/note/encrypt', {
			secret: userService.user.secret,
			title: note.title,
			data: note.text,
			shared: note.shared
		}).then(function (resp) {
			cb(resp.data);
		});
	}

	this.save = function (note, cb) {
		note.shared = 1;
		saveNote(note, function (resp) {
			cb(resp.error);
		});
	}

	this.encrypt = function (note, cb) {
		note.shared = 0;
		saveNote(note, function (resp) {
			cb(resp.error);
		});
	}

	this.list = function (publicKey, cb) {
		$http.get('/api/dapps/' + idFactory + '/api/note/list?publicKey=' + publicKey).then(function (resp) {
			cb(resp.data);
		});
	}

	this.get = function (id, cb) {
		$http.get("/api/dapps/" + idFactory + "/api/note/get?id=" + id).then(function (resp) {
			cb(resp.data);
		});
	}

	this.decrypt = function (id, cb) {
		$http.post("/api/dapps/" + idFactory + "/api/note/decrypt", {
			id : id,
			secret : userService.user.secret
		}).then(function (resp) {
			cb(resp.data);
		});
	}

}]);