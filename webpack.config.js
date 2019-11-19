module.exports = {
	mode: "production",
	performance: {
		maxEntrypointSize: 500000
	},
	entry: "./src/popup.js",
	output: {
		filename: "popup.js"
	},
	node: {
		fs: "empty"
	}
};
