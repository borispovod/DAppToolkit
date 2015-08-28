module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        cssmin: {
            compress: {
                options: {
                    keepSpecialComments: "0"
                },
                files: {
                    "static/css/app.css": [
                        "tmp/app.css"
                    ]
                }
            }
        },
        less: {
            app: {
                files: {
                    "tmp/app.css": [
                        "styles/application.less"
                    ]
                }
            }
        },
        concat: {
            options: {},
            dist: {
                src: [
                    "js/**/*.js",
                    "js/controllers/appController.js",
                    "js/controllers/loginController.js",
                    "js/controllers/workspaceController.js",
                    "js/controllers/modals/depositModalController.js",
                    "js/controllers/modals/withdrawalModalController.js",
                    "js/modules/modals.js",
                    "js/services/authService.js",
                    "js/services/userService.js",
                    "js/services/noteService.js",
                    "js/factories/idFactory.js",
                    "js/filters/xcrFilter.js",
                    "js/directives/dropdownDirective.js"
                ],
                dest: "static/js/app.js"
            }
        }


    });


    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-cssmin");
    grunt.loadNpmTasks("grunt-contrib-less");

    grunt.registerTask("default", ["less", "cssmin", "concat"]);
};
