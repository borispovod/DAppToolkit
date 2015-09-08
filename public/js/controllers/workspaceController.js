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