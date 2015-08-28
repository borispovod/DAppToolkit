encryptiApp = angular.module('encryptiApp', ['ui.router', 'ui.bootstrap']);

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
            }).state('main.workspace.deposit', {
                url: "/deposit",
                onEnter: ['$stateParams', '$state', '$modal', function ($stateParams, $state, $modal) {
                    $modal.open({
                        templateUrl: "partials/modals/deposit.html",
                        controller: "depositModalController"
                    }).result.finally(function () {
                            $state.go('^');
                        });
                }]
            })
            .state('main.workspace.withdrawal', {
                url: "/withdrawal",
                onEnter: ['$stateParams', '$state', '$modal', function ($stateParams, $state, $modal) {
                    $modal.open({
                        templateUrl: "partials/modals/withdrawal.html",
                        controller: "withdrawalModalController"
                    }).result.finally(function () {
                            $state.go('^');
                        });
                }]
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