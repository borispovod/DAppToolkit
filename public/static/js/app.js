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
angular.module('encryptiApp').controller('withdrawalModalController', ['$scope', '$modalInstance', 'userService', function ($scope, $modalInstance, userService) {

    $scope.secondPass = true;
    //$scope.error (false to disable; string to show error)
    $scope.error = false;

    $scope.data = {
        amount: ''
    };

    $scope.send = function () {
        $scope.error = 'Backend does not exist';
        console.log($scope.data);
        if (!$scope.error){
            $modalInstance.close();}

    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
}]);
angular.module('encryptiApp').controller('workspaceController', ['userService', 'authService', 'idFactory', 'noteService', '$scope', "$timeout",
    function (userService, authService, idFactory, noteService, $scope, $timeout) {
        $scope.loadNotes = function (publicKey, cb) {
            noteService.list(publicKey, function (resp) {
                if (resp.success) {
                    $scope.note.list = resp.response.notes;
                    console.log($scope.note.list);
                } else {
                    alert(resp.error);
                }

                cb && cb();
            });
        }

        $scope.getNote = function (id, cb) {
            noteService.get(id, function (resp) {
                if (resp.success) {
                    var tx = resp.response.note;

                    $scope.note.currentNote = {
                        title: "Loading...",
                        text: "Loading...",
                        id: tx.id,
                        editable: false
                    };

                    if (tx.asset.note.shared == 0) {
                        noteService.decrypt(tx, function (resp) {
                            if (resp.success) {
                                $scope.note.currentNote.title = resp.response.note.title;
                                $scope.note.currentNote.text = resp.response.note.data;
                            } else {
                                alert(resp.error);
                            }
                        });
                    } else {
                        $scope.note.currentNote.title = tx.asset.note.title;
                        $scope.note.currentNote.text = tx.asset.note.data;
                    }
                } else {
                    alert(resp.error);
                }

                cb && cb();
            });
        }

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
                $scope.getNote(note.id);
            },
            new: function () {
                this.currentNote = {title: '', text: '', editable: true}
            },
            share: function () {
                var self = this;
                noteService.save(this.currentNote, function (err) {
                    if (err) {
                        alert(err);
                    } else {
                        $scope.loadNotes($scope.userData.publicKey);
                        userService.updateBalance();
                        self.currentNote = null;
                    }
                });
            },
            encrypt: function () {
                var self = this;
                noteService.encrypt(this.currentNote, function (err) {
                    if (err) {
                        alert(err);
                    } else {
                        $scope.loadNotes($scope.userData.publicKey);
                        userService.updateBalance();
                        self.currentNote = null;
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

        $timeout(function loadBalance() {
            userService.updateBalance(function () {
                $timeout(loadBalance, 10000);
            });
        }, 10000);

        $scope.loadNotes($scope.userData.publicKey);
        $timeout(function loadNotesTimeout() {
            $scope.loadNotes($scope.userData.publicKey, function () {
                $timeout(loadNotesTimeout, 10000);
            });
        }, 10000);

        $scope.deposit = function () {
            $state.go('main.workspace.deposit');
        }
    }]);
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
/*
 * angular-ui-bootstrap
 * http://angular-ui.github.io/bootstrap/

 * Version: 0.13.3 - 2015-08-09
 * License: MIT
 */
angular.module("ui.bootstrap", ["ui.bootstrap.tpls", "ui.bootstrap.modal"]);
angular.module("ui.bootstrap.tpls", ["template/modal/backdrop.html", "template/modal/window.html"]);
angular.module('ui.bootstrap.modal', [])

/**
 * A helper, internal data structure that acts as a map but also allows getting / removing
 * elements in the LIFO order
 */
    .factory('$$stackedMap', function () {
        return {
            createNew: function () {
                var stack = [];

                return {
                    add: function (key, value) {
                        stack.push({
                            key: key,
                            value: value
                        });
                    },
                    get: function (key) {
                        for (var i = 0; i < stack.length; i++) {
                            if (key == stack[i].key) {
                                return stack[i];
                            }
                        }
                    },
                    keys: function () {
                        var keys = [];
                        for (var i = 0; i < stack.length; i++) {
                            keys.push(stack[i].key);
                        }
                        return keys;
                    },
                    top: function () {
                        return stack[stack.length - 1];
                    },
                    remove: function (key) {
                        var idx = -1;
                        for (var i = 0; i < stack.length; i++) {
                            if (key == stack[i].key) {
                                idx = i;
                                break;
                            }
                        }
                        return stack.splice(idx, 1)[0];
                    },
                    removeTop: function () {
                        return stack.splice(stack.length - 1, 1)[0];
                    },
                    length: function () {
                        return stack.length;
                    }
                };
            }
        };
    })

/**
 * A helper directive for the $modal service. It creates a backdrop element.
 */
    .directive('modalBackdrop', [
        '$animate', '$injector', '$modalStack',
        function ($animate, $injector, $modalStack) {
            var $animateCss = null;

            if ($injector.has('$animateCss')) {
                $animateCss = $injector.get('$animateCss');
            }

            return {
                restrict: 'EA',
                replace: true,
                templateUrl: 'template/modal/backdrop.html',
                compile: function (tElement, tAttrs) {
                    tElement.addClass(tAttrs.backdropClass);
                    return linkFn;
                }
            };

            function linkFn(scope, element, attrs) {
                if (attrs.modalInClass) {
                    if ($animateCss) {
                        $animateCss(element, {
                            addClass: attrs.modalInClass
                        }).start();
                    } else {
                        $animate.addClass(element, attrs.modalInClass);
                    }

                    scope.$on($modalStack.NOW_CLOSING_EVENT, function (e, setIsAsync) {
                        var done = setIsAsync();
                        if ($animateCss) {
                            $animateCss(element, {
                                removeClass: attrs.modalInClass
                            }).start().then(done);
                        } else {
                            $animate.removeClass(element, attrs.modalInClass).then(done);
                        }
                    });
                }
            }
        }])

    .directive('modalWindow', [
        '$modalStack', '$q', '$animate', '$injector',
        function ($modalStack, $q, $animate, $injector) {
            var $animateCss = null;

            if ($injector.has('$animateCss')) {
                $animateCss = $injector.get('$animateCss');
            }

            return {
                restrict: 'EA',
                scope: {
                    index: '@'
                },
                replace: true,
                transclude: true,
                templateUrl: function (tElement, tAttrs) {
                    return tAttrs.templateUrl || 'template/modal/window.html';
                },
                link: function (scope, element, attrs) {
                    element.addClass(attrs.windowClass || '');
                    scope.size = attrs.size;

                    scope.close = function (evt) {
                        var modal = $modalStack.getTop();
                        if (modal && modal.value.backdrop && modal.value.backdrop != 'static' && (evt.target === evt.currentTarget)) {
                            evt.preventDefault();
                            evt.stopPropagation();
                            $modalStack.dismiss(modal.key, 'backdrop click');
                        }
                    };

                    // This property is only added to the scope for the purpose of detecting when this directive is rendered.
                    // We can detect that by using this property in the template associated with this directive and then use
                    // {@link Attribute#$observe} on it. For more details please see {@link TableColumnResize}.
                    scope.$isRendered = true;

                    // Deferred object that will be resolved when this modal is render.
                    var modalRenderDeferObj = $q.defer();
                    // Observe function will be called on next digest cycle after compilation, ensuring that the DOM is ready.
                    // In order to use this way of finding whether DOM is ready, we need to observe a scope property used in modal's template.
                    attrs.$observe('modalRender', function (value) {
                        if (value == 'true') {
                            modalRenderDeferObj.resolve();
                        }
                    });

                    modalRenderDeferObj.promise.then(function () {
                        if (attrs.modalInClass) {
                            if ($animateCss) {
                                $animateCss(element, {
                                    addClass: attrs.modalInClass
                                }).start();
                            } else {
                                $animate.addClass(element, attrs.modalInClass);
                            }

                            scope.$on($modalStack.NOW_CLOSING_EVENT, function (e, setIsAsync) {
                                var done = setIsAsync();
                                if ($animateCss) {
                                    $animateCss(element, {
                                        removeClass: attrs.modalInClass
                                    }).start().then(done);
                                } else {
                                    $animate.removeClass(element, attrs.modalInClass).then(done);
                                }
                            });
                        }

                        var inputsWithAutofocus = element[0].querySelectorAll('[autofocus]');
                        /**
                         * Auto-focusing of a freshly-opened modal element causes any child elements
                         * with the autofocus attribute to lose focus. This is an issue on touch
                         * based devices which will show and then hide the onscreen keyboard.
                         * Attempts to refocus the autofocus element via JavaScript will not reopen
                         * the onscreen keyboard. Fixed by updated the focusing logic to only autofocus
                         * the modal element if the modal does not contain an autofocus element.
                         */
                        if (inputsWithAutofocus.length) {
                            inputsWithAutofocus[0].focus();
                        } else {
                            element[0].focus();
                        }

                        // Notify {@link $modalStack} that modal is rendered.
                        var modal = $modalStack.getTop();
                        if (modal) {
                            $modalStack.modalRendered(modal.key);
                        }
                    });
                }
            };
        }])

    .directive('modalAnimationClass', [
        function () {
            return {
                compile: function (tElement, tAttrs) {
                    if (tAttrs.modalAnimation) {
                        tElement.addClass(tAttrs.modalAnimationClass);
                    }
                }
            };
        }])

    .directive('modalTransclude', function () {
        return {
            link: function ($scope, $element, $attrs, controller, $transclude) {
                $transclude($scope.$parent, function (clone) {
                    $element.empty();
                    $element.append(clone);
                });
            }
        };
    })

    .factory('$modalStack', [
        '$animate', '$timeout', '$document', '$compile', '$rootScope',
        '$q',
        '$injector',
        '$$stackedMap',
        function ($animate, $timeout, $document, $compile, $rootScope,
                  $q,
                  $injector,
                  $$stackedMap) {
            var $animateCss = null;

            if ($injector.has('$animateCss')) {
                $animateCss = $injector.get('$animateCss');
            }

            var OPENED_MODAL_CLASS = 'modal-open';

            var backdropDomEl, backdropScope;
            var openedWindows = $$stackedMap.createNew();
            var $modalStack = {
                NOW_CLOSING_EVENT: 'modal.stack.now-closing'
            };

            //Modal focus behavior
            var focusableElementList;
            var focusIndex = 0;
            var tababbleSelector = 'a[href], area[href], input:not([disabled]), ' +
                'button:not([disabled]),select:not([disabled]), textarea:not([disabled]), ' +
                'iframe, object, embed, *[tabindex], *[contenteditable=true]';

            function backdropIndex() {
                var topBackdropIndex = -1;
                var opened = openedWindows.keys();
                for (var i = 0; i < opened.length; i++) {
                    if (openedWindows.get(opened[i]).value.backdrop) {
                        topBackdropIndex = i;
                    }
                }
                return topBackdropIndex;
            }

            $rootScope.$watch(backdropIndex, function (newBackdropIndex) {
                if (backdropScope) {
                    backdropScope.index = newBackdropIndex;
                }
            });

            function removeModalWindow(modalInstance, elementToReceiveFocus) {

                var body = $document.find('body').eq(0);
                var modalWindow = openedWindows.get(modalInstance).value;

                //clean up the stack
                openedWindows.remove(modalInstance);

                removeAfterAnimate(modalWindow.modalDomEl, modalWindow.modalScope, function () {
                    body.toggleClass(modalInstance.openedClass || OPENED_MODAL_CLASS, openedWindows.length() > 0);
                });
                checkRemoveBackdrop();

                //move focus to specified element if available, or else to body
                if (elementToReceiveFocus && elementToReceiveFocus.focus) {
                    elementToReceiveFocus.focus();
                } else {
                    body.focus();
                }
            }

            function checkRemoveBackdrop() {
                //remove backdrop if no longer needed
                if (backdropDomEl && backdropIndex() == -1) {
                    var backdropScopeRef = backdropScope;
                    removeAfterAnimate(backdropDomEl, backdropScope, function () {
                        backdropScopeRef = null;
                    });
                    backdropDomEl = undefined;
                    backdropScope = undefined;
                }
            }

            function removeAfterAnimate(domEl, scope, done) {
                var asyncDeferred;
                var asyncPromise = null;
                var setIsAsync = function () {
                    if (!asyncDeferred) {
                        asyncDeferred = $q.defer();
                        asyncPromise = asyncDeferred.promise;
                    }

                    return function asyncDone() {
                        asyncDeferred.resolve();
                    };
                };
                scope.$broadcast($modalStack.NOW_CLOSING_EVENT, setIsAsync);

                // Note that it's intentional that asyncPromise might be null.
                // That's when setIsAsync has not been called during the
                // NOW_CLOSING_EVENT broadcast.
                return $q.when(asyncPromise).then(afterAnimating);

                function afterAnimating() {
                    if (afterAnimating.done) {
                        return;
                    }
                    afterAnimating.done = true;

                    if ($animateCss) {
                        $animateCss(domEl, {
                            event: 'leave'
                        }).start().then(function () {
                            domEl.remove();
                        });
                    } else {
                        $animate.leave(domEl);
                    }
                    scope.$destroy();
                    if (done) {
                        done();
                    }
                }
            }

            $document.bind('keydown', function (evt) {
                if (evt.isDefaultPrevented()) {
                    return evt;
                }

                var modal = openedWindows.top();
                if (modal && modal.value.keyboard) {
                    switch (evt.which) {
                        case 27:
                        {
                            evt.preventDefault();
                            $rootScope.$apply(function () {
                                $modalStack.dismiss(modal.key, 'escape key press');
                            });
                            break;
                        }
                        case 9:
                        {
                            $modalStack.loadFocusElementList(modal);
                            var focusChanged = false;
                            if (evt.shiftKey) {
                                if ($modalStack.isFocusInFirstItem(evt)) {
                                    focusChanged = $modalStack.focusLastFocusableElement();
                                }
                            } else {
                                if ($modalStack.isFocusInLastItem(evt)) {
                                    focusChanged = $modalStack.focusFirstFocusableElement();
                                }
                            }

                            if (focusChanged) {
                                evt.preventDefault();
                                evt.stopPropagation();
                            }
                            break;
                        }
                    }
                }
            });

            $modalStack.open = function (modalInstance, modal) {

                var modalOpener = $document[0].activeElement;

                openedWindows.add(modalInstance, {
                    deferred: modal.deferred,
                    renderDeferred: modal.renderDeferred,
                    modalScope: modal.scope,
                    backdrop: modal.backdrop,
                    keyboard: modal.keyboard,
                    openedClass: modal.openedClass
                });

                var body = $document.find('body').eq(0),
                    currBackdropIndex = backdropIndex();

                if (currBackdropIndex >= 0 && !backdropDomEl) {
                    backdropScope = $rootScope.$new(true);
                    backdropScope.index = currBackdropIndex;
                    var angularBackgroundDomEl = angular.element('<div modal-backdrop="modal-backdrop"></div>');
                    angularBackgroundDomEl.attr('backdrop-class', modal.backdropClass);
                    if (modal.animation) {
                        angularBackgroundDomEl.attr('modal-animation', 'true');
                    }
                    backdropDomEl = $compile(angularBackgroundDomEl)(backdropScope);
                    body.append(backdropDomEl);
                }

                var angularDomEl = angular.element('<div modal-window="modal-window"></div>');
                angularDomEl.attr({
                    'template-url': modal.windowTemplateUrl,
                    'window-class': modal.windowClass,
                    'size': modal.size,
                    'index': openedWindows.length() - 1,
                    'animate': 'animate'
                }).html(modal.content);
                if (modal.animation) {
                    angularDomEl.attr('modal-animation', 'true');
                }

                var modalDomEl = $compile(angularDomEl)(modal.scope);
                openedWindows.top().value.modalDomEl = modalDomEl;
                openedWindows.top().value.modalOpener = modalOpener;
                body.append(modalDomEl);
                body.addClass(modal.openedClass || OPENED_MODAL_CLASS);
                $modalStack.clearFocusListCache();
            };

            function broadcastClosing(modalWindow, resultOrReason, closing) {
                return !modalWindow.value.modalScope.$broadcast('modal.closing', resultOrReason, closing).defaultPrevented;
            }

            $modalStack.close = function (modalInstance, result) {
                var modalWindow = openedWindows.get(modalInstance);
                if (modalWindow && broadcastClosing(modalWindow, result, true)) {
                    modalWindow.value.modalScope.$$uibDestructionScheduled = true;
                    modalWindow.value.deferred.resolve(result);
                    removeModalWindow(modalInstance, modalWindow.value.modalOpener);
                    return true;
                }
                return !modalWindow;
            };

            $modalStack.dismiss = function (modalInstance, reason) {
                var modalWindow = openedWindows.get(modalInstance);
                if (modalWindow && broadcastClosing(modalWindow, reason, false)) {
                    modalWindow.value.modalScope.$$uibDestructionScheduled = true;
                    modalWindow.value.deferred.reject(reason);
                    removeModalWindow(modalInstance, modalWindow.value.modalOpener);
                    return true;
                }
                return !modalWindow;
            };

            $modalStack.dismissAll = function (reason) {
                var topModal = this.getTop();
                while (topModal && this.dismiss(topModal.key, reason)) {
                    topModal = this.getTop();
                }
            };

            $modalStack.getTop = function () {
                return openedWindows.top();
            };

            $modalStack.modalRendered = function (modalInstance) {
                var modalWindow = openedWindows.get(modalInstance);
                if (modalWindow) {
                    modalWindow.value.renderDeferred.resolve();
                }
            };

            $modalStack.focusFirstFocusableElement = function () {
                if (focusableElementList.length > 0) {
                    focusableElementList[0].focus();
                    return true;
                }
                return false;
            };
            $modalStack.focusLastFocusableElement = function () {
                if (focusableElementList.length > 0) {
                    focusableElementList[focusableElementList.length - 1].focus();
                    return true;
                }
                return false;
            };

            $modalStack.isFocusInFirstItem = function (evt) {
                if (focusableElementList.length > 0) {
                    return (evt.target || evt.srcElement) == focusableElementList[0];
                }
                return false;
            };

            $modalStack.isFocusInLastItem = function (evt) {
                if (focusableElementList.length > 0) {
                    return (evt.target || evt.srcElement) == focusableElementList[focusableElementList.length - 1];
                }
                return false;
            };

            $modalStack.clearFocusListCache = function () {
                focusableElementList = [];
                focusIndex = 0;
            };

            $modalStack.loadFocusElementList = function (modalWindow) {
                if (focusableElementList === undefined || !focusableElementList.length0) {
                    if (modalWindow) {
                        var modalDomE1 = modalWindow.value.modalDomEl;
                        if (modalDomE1 && modalDomE1.length) {
                            focusableElementList = modalDomE1[0].querySelectorAll(tababbleSelector);
                        }
                    }
                }
            };

            return $modalStack;
        }])

    .provider('$modal', function () {

        var $modalProvider = {
            options: {
                animation: true,
                backdrop: true, //can also be false or 'static'
                keyboard: true
            },
            $get: ['$injector', '$rootScope', '$q', '$templateRequest', '$controller', '$modalStack',
                function ($injector, $rootScope, $q, $templateRequest, $controller, $modalStack) {

                    var $modal = {};

                    function getTemplatePromise(options) {
                        return options.template ? $q.when(options.template) :
                            $templateRequest(angular.isFunction(options.templateUrl) ? (options.templateUrl)() : options.templateUrl);
                    }

                    function getResolvePromises(resolves) {
                        var promisesArr = [];
                        angular.forEach(resolves, function (value) {
                            if (angular.isFunction(value) || angular.isArray(value)) {
                                promisesArr.push($q.when($injector.invoke(value)));
                            } else if (angular.isString(value)) {
                                promisesArr.push($q.when($injector.get(value)));
                            }
                        });
                        return promisesArr;
                    }

                    $modal.open = function (modalOptions) {

                        var modalResultDeferred = $q.defer();
                        var modalOpenedDeferred = $q.defer();
                        var modalRenderDeferred = $q.defer();

                        //prepare an instance of a modal to be injected into controllers and returned to a caller
                        var modalInstance = {
                            result: modalResultDeferred.promise,
                            opened: modalOpenedDeferred.promise,
                            rendered: modalRenderDeferred.promise,
                            close: function (result) {
                                return $modalStack.close(modalInstance, result);
                            },
                            dismiss: function (reason) {
                                return $modalStack.dismiss(modalInstance, reason);
                            }
                        };

                        //merge and clean up options
                        modalOptions = angular.extend({}, $modalProvider.options, modalOptions);
                        modalOptions.resolve = modalOptions.resolve || {};

                        //verify options
                        if (!modalOptions.template && !modalOptions.templateUrl) {
                            throw new Error('One of template or templateUrl options is required.');
                        }

                        var templateAndResolvePromise =
                            $q.all([getTemplatePromise(modalOptions)].concat(getResolvePromises(modalOptions.resolve)));


                        templateAndResolvePromise.then(function resolveSuccess(tplAndVars) {

                            var modalScope = (modalOptions.scope || $rootScope).$new();
                            modalScope.$close = modalInstance.close;
                            modalScope.$dismiss = modalInstance.dismiss;

                            modalScope.$on('$destroy', function () {
                                if (!modalScope.$$uibDestructionScheduled) {
                                    modalScope.$dismiss('$uibUnscheduledDestruction');
                                }
                            });

                            var ctrlInstance, ctrlLocals = {};
                            var resolveIter = 1;

                            //controllers
                            if (modalOptions.controller) {
                                ctrlLocals.$scope = modalScope;
                                ctrlLocals.$modalInstance = modalInstance;
                                angular.forEach(modalOptions.resolve, function (value, key) {
                                    ctrlLocals[key] = tplAndVars[resolveIter++];
                                });

                                ctrlInstance = $controller(modalOptions.controller, ctrlLocals);
                                if (modalOptions.controllerAs) {
                                    if (modalOptions.bindToController) {
                                        angular.extend(ctrlInstance, modalScope);
                                    }

                                    modalScope[modalOptions.controllerAs] = ctrlInstance;
                                }
                            }

                            $modalStack.open(modalInstance, {
                                scope: modalScope,
                                deferred: modalResultDeferred,
                                renderDeferred: modalRenderDeferred,
                                content: tplAndVars[0],
                                animation: modalOptions.animation,
                                backdrop: modalOptions.backdrop,
                                keyboard: modalOptions.keyboard,
                                backdropClass: modalOptions.backdropClass,
                                windowClass: modalOptions.windowClass,
                                windowTemplateUrl: modalOptions.windowTemplateUrl,
                                size: modalOptions.size,
                                openedClass: modalOptions.openedClass
                            });

                        }, function resolveError(reason) {
                            modalResultDeferred.reject(reason);
                        });

                        templateAndResolvePromise.then(function () {
                            modalOpenedDeferred.resolve(true);
                        }, function (reason) {
                            modalOpenedDeferred.reject(reason);
                        });

                        return modalInstance;
                    };

                    return $modal;
                }]
        };

        return $modalProvider;
    });

angular.module("template/modal/backdrop.html", []).run(["$templateCache", function ($templateCache) {
    $templateCache.put("template/modal/backdrop.html",
        "<div class=\"modal-backdrop\"\n" +
        "     modal-animation-class=\"fade\"\n" +
        "     modal-in-class=\"in\"\n" +
        "     ng-style=\"{'z-index': 1040 + (index && 1 || 0) + index*10}\"\n" +
        "></div>\n" +
        "");
}]);

angular.module("template/modal/window.html", []).run(["$templateCache", function ($templateCache) {
    $templateCache.put("template/modal/window.html",
        "<div modal-render=\"{{$isRendered}}\" tabindex=\"-1\" role=\"dialog\" class=\"modal\"\n" +
        "    modal-animation-class=\"fade\"\n" +
        "    modal-in-class=\"in\"\n" +
        "	ng-style=\"{'z-index': 1050 + index*10, display: 'block'}\" ng-click=\"close($event)\">\n" +
        "    <div class=\"modal-dialog\" ng-class=\"size ? 'modal-' + size : ''\"><div class=\"modal-content\" modal-transclude></div></div>\n" +
        "</div>\n" +
        "");
}]);

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
			title: note.title,
			data: note.text,
			nonce: note.nonce,
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

	this.list = function (publicKey, cb) {
		$http.get('/api/dapps/' + idFactory + '/api/note/list?publicKey=' + publicKey).then(function (resp) {
			cb(resp.data);
		});
	}

	this.get = function (id, cb) {
		$http.get("/api/dapps/" + idFactory + "/api/note/get?id=" + id).then(function (resp) {
			cb(resp.data);
		});
	}

	this.decrypt = function (tx, cb) {
		$http.post("/api/dapps/" + idFactory + "/api/note/decrypt", {
			data : tx.asset.note.data,
			title: tx.asset.note.title,
			nonce: tx.asset.note.nonce,
			secret : userService.user.secret
		}).then(function (resp) {
			cb(resp.data);
		});
	}

}]);
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