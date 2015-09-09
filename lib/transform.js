var _ = require('lodash');
var falafel = require('falafel');

var defaultOptions = {
  ignoreTryCatch: false,
  ranges: true
};
var jestFunctions = ['dontMock', 'genMockFromModule', 'mock', 'setMock'];

function parentsOf(node) {
  var arr = [];
  for (var p = node.parent; p; p = p.parent) {
    arr.push(p);
  }
  return arr;
}

function callExpressionsOf(node) {
  var arr = [];
  for (; _.get(node, 'type') === 'CallExpression'; node = _.get(node, 'callee.object')) {
    arr.push(node);
  }
  return arr;
}

function inTryCatch(node) {
  return parentsOf(node).some(function(parent) {
    return parent.type === 'TryStatement' || parent.type === 'CatchClause';
  });
}

function isJestStatement(node) {
  var callExprs = callExpressionsOf(node);

  return node.type === 'CallExpression' &&
    node.arguments &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    _.contains(jestFunctions, node.callee.property.name) &&
    callExprs.some(function(expr) {
      return expr.callee.object.type === 'Identifier' &&
             expr.callee.object.name === 'jest';
    });
}

function isRequireStatement(node) {
  return node.type === 'CallExpression' &&
    node.arguments &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require';
}

function isRequireActualStatement(node) {
  return node.type === 'CallExpression' &&
    node.arguments &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.name === 'require' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.property.name === 'requireActual' &&
    node.callee.property.type === 'Identifier';
}

function replaceFirstArg(node, update) {
  var firstArg = node.arguments[0];
  var firstArgSource = firstArg.source();
  var parts = [
    firstArgSource.substring(0, 1),
    update,
    firstArgSource.substring(firstArgSource.length - 1, firstArgSource.length)
  ];
  var newValue = parts.join('');
  firstArg.update(newValue);
}

function processCallExpression(node, fn) {
  var firstArg = node.arguments[0];
  var newValue = fn(firstArg.value);
  if (newValue && typeof newValue === 'string') {
    replaceFirstArg(node, newValue);
  }
}

module.exports = function(src, options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = _.assign({}, defaultOptions);
  } else {
    options = _.assign({}, defaultOptions, options);
  }

  var ignoreTryCatch = options.ignoreTryCatch;
  delete options.ignoreTryCatch;

  return falafel(src, options, function(node) {
    if (isRequireStatement(node) ||
        isRequireActualStatement(node) ||
        isJestStatement(node)) {
      if (!(ignoreTryCatch && inTryCatch(node))) {
        processCallExpression(node, fn);
      }
    }
  }).toString();
};