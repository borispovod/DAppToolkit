

angular.module('encryptiApp').service('authService', ['$state', function ($state) {

	this.setLogged = function () {
		this.isLogged = true;
		$state.go('main.workspace');
	}

	this.setUnlogged = function () {
		this.isLogged = false;
		$state.go('main.login');
	}
}]);