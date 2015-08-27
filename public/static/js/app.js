encryptiApp = angular.module('encryptiApp', ['ui.router']);

encryptiApp.config([
    "$locationProvider",
    "$stateProvider",
    "$urlRouterProvider",
    function ($locationProvider, $stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise("/workspace");
        $stateProvider
            .state('main', {
                abstract: true,
                templateUrl: "partials/app-template.html",
                controller: "appController"
            })
            .state('main.login', {
                url: "/login",
                templateUrl: "partials/login.html",
                controller: "loginController"
            })
            .state('main.workspace', {
                url: "/workspace",
                templateUrl: "partials/workspace.html",
                controller: "workspaceController"
            })

    }
]);

encryptiApp.run(function ($rootScope, $location, $state, authService) {

    angular.element(document).on("click", function (e) {
        $rootScope.$broadcast("documentClicked", angular.element(e.target));
    });

    $rootScope.$on('$stateChangeStart', function (e, toState, toParams, fromState, fromParams) {

        var isLogin = toState.name === "main.login";
        if (isLogin || authService.isLogged) {
            return; // no need to redirect
        }
            e.preventDefault(); // stop current execution
            $state.go('main.login'); // go to login

    });
});
angular.module('encryptiApp').controller('appController', [
    function () {

    }]);
angular.module('encryptiApp').controller('loginController', ['authService', 'userService', '$scope',
    function (authService, userService, $scope) {
        $scope.pass = "";
        $scope.login = function(pass){
            if (pass.trim()!=""){
                authService.setLogged();
                userService.setUser(pass.trim());
            }
        }
    }]);
angular.module('encryptiApp').controller('workspaceController', ['userService', '$scope',
    function (userService, $scope) {

        $scope.note = {
            list: [{title: 'test1', id: 1}, {title: 'test2', id: 2}],
            currentNote: {
                title: 'You don`t have a text file yet, you should add one. :)',
                text: 'How to add your own text file:\n' +
                '\n' +
                '1.) Click on the three dots in the top right corner.\n' +
                '2.) Click on the item New Text.\n' +
                '3.) Start writing.\n' +
                '\n' +
                '\n' + '\n' +
                '\n' +
                'We hope you like our decentralized application.\n' +
                '\n' +
                '\n' +
                'Your Encrypti Team\n',
                editable: false
            },
            load: function (note) {
                this.currentNote = {title: note.title, text: note.text, date: note.date, editable: true, id: note.id}
            },
            new: function () {
                this.currentNote = {title: '', text: '', editable: true}
            },
            share: function () {
                //sharing code for this.currentNote here
            }
        };

        $scope.userData = userService;

        if ($scope.note.list.length > 0) {
            $scope.note.load($scope.note.list[0]);
        }

    }]);


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
angular.module('encryptiApp').service('userService', [function () {

    this.setUser = function (user) {
        this.user = user;
    }
}]);
angular.module('encryptiApp').directive("dropdown", function ($rootScope, authService) {
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
