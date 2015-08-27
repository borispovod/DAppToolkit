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
        $scope.login = function(pass) {
            if (pass.trim() != ""){
                authService.setLogged(pass);
            }
        }
    }]);
angular.module('encryptiApp').controller('workspaceController', ['userService', 'authService', 'noteService', '$scope',
    function (userService, authService, noteService, $scope) {

        $scope.note = {
            list: [],
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
                noteService.save(this.currentNote, function (err) {
                    if (err) {
                        alert(err);
                    }
                });
            },
            encrypt: function () {
                noteService.encrypt(this.currentNote, function (err) {
                    if (err) {
                        alert(err);
                    }
                })
            }
        };

        $scope.userData = userService.user;

        if ($scope.note.list.length > 0) {
            $scope.note.load($scope.note.list[0]);
        }

        $scope.logout = function () {
            authService.setUnlogged();
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

angular.module('encryptiApp').factory('idFactory', ['$location',  function ($location) {
	var url = $location.absUrl();
	var parts = url.split('/');
	var dappId = parts[parts.indexOf('dapps') + 1];
	return dappId;
}]);
angular.module('encryptiApp').filter('xcrFilter', function () {
	return function (value) {
		return value / 100000000;
	}
});
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
angular.module('encryptiApp').service('userService', [function () {
    this.setUser = function (user) {
        this.user = user;
    }

    this.clearUser = function () {
        delete this.user;
    }
}]);