const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development', // Switch to 'production' for minified builds
  devtool: 'inline-source-map', // Use inline-source-map instead of eval for CSP compatibility
  entry: {
    // Background scripts
    'background/background': './src/background/background.ts',

    // Content scripts
    'js/content': './src/content/content.ts',

    // UI scripts
    'js/options': './src/views/options/options.ts',
    'js/popup': './src/views/popup/popup.ts',
    'js/sidepanel': './src/views/sidepanel/sidepanel.ts',

    // Utility scripts
    'js/tab-manager': './src/services/tab-manager.ts',
    'js/storage-manager': './src/services/storage-manager.ts',
    'js/duplicate-detector': './src/services/duplicate-detector.ts',
    'js/group-manager': './src/services/group-manager.ts',
    'js/llm-service': './src/services/llm-service.ts'
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
        { from: 'src/views/**/*.html', to: 'views/[name][ext]' },

        // Copy CSS files
        { from: 'src/views/**/*.css', to: 'css/[name][ext]' },


        // Copy images
        { from: 'src/images', to: 'images', noErrorOnMissing: true },
      ],
    }),
  ],
};