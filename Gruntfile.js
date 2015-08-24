module.exports = function(grunt) {
	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		jshint: {
			options: {
				jshintrc: true
			},
			all: ["Gruntfile.js", "api/**/*.js", "lib/**/*.js", "modules/**/*.js", "index.js"]
		}
	});

	// Load task(s).
	grunt.loadNpmTasks("grunt-contrib-jshint");

	// Default task(s).
	grunt.registerTask("default", ["jshint"]);
};
