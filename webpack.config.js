const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development', // Switch to 'production' for minified builds
  devtool: 'inline-source-map', // Use inline-source-map instead of eval for CSP compatibility
  entry: {
    // Background scripts
    'background/background': './src/background/background.ts',

    // Content scripts
    'js/content': './src/js/content.ts',

    // UI scripts
    'js/popup': './src/js/popup.ts',
    'js/sidepanel': './src/js/sidepanel.ts',
    'js/options': './src/js/options.ts',

    // Utility scripts
    'js/tab-manager': './src/js/tab-manager.ts',
    'js/storage-manager': './src/js/storage-manager.ts',
    'js/duplicate-detector': './src/js/duplicate-detector.ts',
    'js/group-manager': './src/js/group-manager.ts',
    'js/llm-service': './src/js/llm-service.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true, // Clean the dist folder before each build
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy manifest
        { from: 'src/manifest.json', to: '.' },

        // Copy HTML files
        { from: 'src/views', to: 'views' },

        // Copy CSS files
        { from: 'src/css', to: 'css' },

        // Copy images
        { from: 'src/images', to: 'images', noErrorOnMissing: true },

        // Copy lib directory if it has content
        { from: 'src/lib', to: 'lib', noErrorOnMissing: true },
      ],
    }),
  ],
};