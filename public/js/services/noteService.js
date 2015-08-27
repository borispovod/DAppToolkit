angular.module('encryptiApp').service('noteService', ['$http', 'idFactory', 'userService', function ($http, idFactory, userService) {
	function saveNote(note, cb) {
		$http.post('/api/dapps/' + idFactory + '/api/note/encrypt', {
			secret: userService.user.secret,
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

}]);