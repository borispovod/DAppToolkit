angular.module('encryptiApp').controller('depositModalController', ['$scope', '$modalInstance', 'userService', '$http', 'idFactory', function ($scope, $modalInstance, userService, $http, idFactory) {
    $scope.convertXCR = function (currency) {
        currency = String(currency);

        var parts = currency.split(".");

        var amount = parts[0];

        //no fractional part
        if (parts.length == 1) {
            var fraction = "00000000";
        } else if (parts.length == 2) {
            if (parts[1].length <= 8) {
                var fraction = parts[1];
            } else {
                var fraction = parts[1].substring(0, 8);
            }
        } else {
            $scope.error = "Wrong XCR value";
            throw "Invalid input";
        }

        for (var i = fraction.length; i < 8; i++) {
            fraction += "0";
        }

        var result = amount + "" + fraction;

        //in case there's a comma or something else in there.. at this point there should only be numbers
        if (!/^\d+$/.test(result)) {
            $scope.error = "Wrong XCR value";
            throw "Invalid input.";
        }

        //remove leading zeroes
        result = result.replace(/^0+/, "");

        if (result === "") {
            result = "0";
        }

        return parseInt(result);
    }

    $scope.secondPass = true;
    //$scope.error (false to disable; string to show error)
    $scope.error = false;

    $scope.data = {
        amount: '',
        secondPass: ''
    };

    $scope.send = function () {
        // convert amount
        try {
            var xcr = $scope.convertXCR($scope.data.amount);
        } catch (e) {
            return;
        }

        $http.put("/api/dapps/transaction", {
            secret : userService.user.secret,
            dappId: idFactory,
            amount: xcr
        }).then(function (resp) {
            if (resp.data.success) {
                $modalInstance.close();
            } else {
                $scope.error = resp.data.error;
            }
        });
    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
}]);