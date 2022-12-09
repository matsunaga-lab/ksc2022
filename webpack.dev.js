const path = require('path')
const { merge } = require('webpack-merge')
const common = require('./webpack.common.js')

module.exports = merge(common, {
	devtool: 'inline-source-map',
	mode: 'none',
	devServer: {
		static: {
			directory: path.join(__dirname, 'public'),
		},
		hot: true,
		port: 8080,
		watchFiles: ['src/**/*'],
	},
})