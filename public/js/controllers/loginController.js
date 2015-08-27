angular.module('encryptiApp').controller('loginController', ['authService', 'userService', '$scope',
    function (authService, userService, $scope) {
        $scope.pass = "";
        $scope.login = function(pass) {
            if (pass.trim() != ""){
                authService.setLogged(pass);
            }
        }
    }]);