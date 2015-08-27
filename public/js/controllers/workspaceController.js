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