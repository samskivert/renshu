var path = require('path');
var webpack = require('webpack');

module.exports = {
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      loader: "ts-loader",
      include: path.join(__dirname, 'src')
    }]
  },

  entry: ['./src/index'],

  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/'
  },

  plugins: [
    new webpack.DefinePlugin({
      __BUILD__: JSON.stringify(new Date().toUTCString())
    })
  ]
};
