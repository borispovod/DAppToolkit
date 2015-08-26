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