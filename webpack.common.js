const path = require('path');
const HtmlPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const { IgnorePlugin } = require('webpack');

module.exports = {
	entry: './src/index.js',
	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, 'public'),
	},
	target: 'web',
	experiments: {
		topLevelAwait: true,
	},
	externals: {
		'pixi.js': 'pixi.js',
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: "./assets", to: path.resolve(__dirname, 'public/assets') },
			],
		}),
		new HtmlPlugin({
			file: path.join(__dirname, 'public', 'index.html'),
			template: './src/index.html'
		})
	],
};