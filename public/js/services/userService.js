angular.module('encryptiApp').service('userService', [function () {

    this.setUser = function (user) {
        this.user = user;
    }
}]);