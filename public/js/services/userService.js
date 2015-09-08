angular.module('encryptiApp').service('userService', ["idFactory", "$http", function (idFactory, $http) {
    this.setUser = function (user) {
        var self = this;
        self.user = user;
    }

    this.updateBalance = function (cb) {
        var self = this;
        $http.get('/api/dapps/' + idFactory + '/api/getAccount?address=' + self.user.address).then(function (resp) {
            self.user.u_balance = resp.data.response.account.u_balance;
            cb && cb();
        });
    }

    this.clearUser = function () {
        delete this.user;
    }
}]);