var jsdom = require('jsdom');
var Promise = require('promise');

module.exports = function(html) {
  return new Promise(function(resolve, reject) {
    jsdom.env(html, function(err, window) {
      resolve(window.document);
    });
  });
}
