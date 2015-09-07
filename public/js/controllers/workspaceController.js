angular.module('encryptiApp').controller('workspaceController', ['userService', 'authService', 'noteService', '$scope', "$timeout",
    function (userService, authService, noteService, $scope, $timeout) {
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
                    var note = resp.response.note;

                    $scope.note.currentNote = {
                        title: note.title,
                        text: note.data,
                        editable: false
                    };

                    if (note.shared == 0) {
                        noteService.decrypt(note.id, function (err, resp) {
                            if (resp.success) {
                                $scope.note.currentNote.title = resp.response.note.title;
                                $scope.note.currentNote.text = resp.response.note.data;
                            } else {
                                alert(resp.error);
                            }
                        });
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
                //this.currentNote = {title: note.title, text: note.text, date: note.date, editable: true, id: note.id}
            },
            new: function () {
                this.currentNote = {title: '', text: '', editable: true}
            },
            share: function () {
                noteService.save(this.currentNote, function (err) {
                    if (err) {
                        alert(err);
                    } else {
                        $scope.loadNotes($scope.userData.publicKey);
                    }
                });
            },
            encrypt: function () {
                noteService.encrypt(this.currentNote, function (err) {
                    if (err) {
                        alert(err);
                    } else {
                        $scope.loadNotes($scope.userData.publicKey);
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

        $scope.loadNotes($scope.userData.publicKey);
        $timeout(function loadNotesTimeout() {
            $scope.loadNotes($scope.userData.publicKey, function () {
                $timeout(loadNotesTimeout, 10000);
            });
        }, 10000);
    }]);