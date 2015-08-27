angular.module('encryptiApp').service('authService', ['$state', 'idFactory', '$http', 'userService', function ($state, idFactory, $http, userService) {
	this.setLogged = function (secret) {
		$http.post('/api/dapps/' + idFactory + '/api/openAccount', {
			secret: secret
		}).then(function (resp) {
			if (resp.data.success) {
				var user = resp.data.response.account;
				user.secret = secret;

				userService.setUser(user);

				this.isLogged = true;
				$state.go('main.workspace');
			}
		}.bind(this));
	}

	this.setUnlogged = function () {
		userService.clearUser();
		this.isLogged = false;
		$state.go('main.login');
	}
}]);