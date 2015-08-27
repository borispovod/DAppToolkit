angular.module('encryptiApp').filter('xcrFilter', function () {
	return function (value) {
		return value / 100000000;
	}
});