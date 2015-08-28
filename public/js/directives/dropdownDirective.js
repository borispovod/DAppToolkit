angular.module('encryptiApp').directive("dropdown", function ($rootScope, authService, $state) {
    return {
        restrict: "E",
        templateUrl: "partials/dropdown.html",
        scope: {
            note: '=scopeNote',
            placeholder: "@",
            list: "=",
            selected: "=",
            property: "@"
        },
        link: function (scope) {

            scope.deposit = function () {
                $state.go('main.workspace.deposit');
            }

            scope.withdrawal = function () {
                $state.go('main.workspace.withdrawal');
            }
            scope.auth = authService;

            scope.listVisible = false;

            scope.logout = function(){
                scope.auth.setUnlogged();
            }

            scope.show = function () {
                scope.listVisible = !scope.listVisible;
            };

            $rootScope.$on("documentClicked", function (inner, target) {
                if ((target[0].className.indexOf("dropdown-display")<0 || target[0].className.indexOf("clicked") < 0)&&
                    (target[0].parentNode.className.indexOf("dropdown-display") < 0 || target[0].parentNode.className.indexOf("clicked") < 0) &&
                    (target[0].className.indexOf("image_wrapper") < 0 ) && (target[0].className.indexOf("dots") < 0 ))
                    scope.$apply(function () {
                        scope.listVisible = false;
                    });
            });

        }
    }
});
