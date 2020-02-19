'use strict';

var core = require('urql/core');

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

var defaultPageInfo = {
  __typename: 'PageInfo',
  endCursor: null,
  startCursor: null,
  hasNextPage: false,
  hasPreviousPage: false
};

var ensureKey = function (x) {
  return typeof x === 'string' ? x : null;
};

var concatEdges = function (cache, leftEdges, rightEdges) {
  var ids = new Set();

  for (var i = 0, l = leftEdges.length; i < l; i++) {
    var edge = leftEdges[i];
    var node = cache.resolve(edge, 'node');

    if (typeof node === 'string') {
      ids.add(node);
    }
  }

  var newEdges = leftEdges.slice();

  for (var i$1 = 0, l$1 = rightEdges.length; i$1 < l$1; i$1++) {
    var edge$1 = rightEdges[i$1];
    var node$1 = cache.resolve(edge$1, 'node');

    if (typeof node$1 === 'string' && !ids.has(node$1)) {
      ids.add(node$1);
      newEdges.push(edge$1);
    }
  }

  return newEdges;
};

var compareArgs = function (fieldArgs, connectionArgs) {
  for (var key in connectionArgs) {
    if (key === 'first' || key === 'last' || key === 'after' || key === 'before') {
      continue;
    } else if (!(key in fieldArgs)) {
      return false;
    }

    var argA = fieldArgs[key];
    var argB = connectionArgs[key];

    if (typeof argA !== typeof argB || typeof argA !== 'object' ? argA !== argB : core.stringifyVariables(argA) !== core.stringifyVariables(argB)) {
      return false;
    }
  }

  for (var key$1 in fieldArgs) {
    if (key$1 === 'first' || key$1 === 'last' || key$1 === 'after' || key$1 === 'before') {
      continue;
    }

    if (!(key$1 in connectionArgs)) {
      return false;
    }
  }

  return true;
};

var getPage = function (cache, entityKey, fieldKey) {
  var link = ensureKey(cache.resolveFieldByKey(entityKey, fieldKey));

  if (!link) {
    return null;
  }

  var typename = cache.resolve(link, '__typename');
  var edges = cache.resolve(link, 'edges') || [];

  if (typeof typename !== 'string') {
    return null;
  }

  var page = {
    __typename: typename,
    edges: edges,
    pageInfo: defaultPageInfo
  };
  var pageInfoKey = cache.resolve(link, 'pageInfo');

  if (typeof pageInfoKey === 'string') {
    var pageInfoType = ensureKey(cache.resolve(pageInfoKey, '__typename'));
    var endCursor = ensureKey(cache.resolve(pageInfoKey, 'endCursor'));
    var startCursor = ensureKey(cache.resolve(pageInfoKey, 'startCursor'));
    var hasNextPage = cache.resolve(pageInfoKey, 'hasNextPage');
    var hasPreviousPage = cache.resolve(pageInfoKey, 'hasPreviousPage');
    var pageInfo = page.pageInfo = {
      __typename: typeof pageInfoType === 'string' ? pageInfoType : 'PageInfo',
      hasNextPage: typeof hasNextPage === 'boolean' ? hasNextPage : !!endCursor,
      hasPreviousPage: typeof hasPreviousPage === 'boolean' ? hasPreviousPage : !!startCursor,
      endCursor: endCursor,
      startCursor: startCursor
    };

    if (pageInfo.endCursor === null) {
      var edge = edges[edges.length - 1];

      if (edge) {
        var endCursor$1 = cache.resolve(edge, 'cursor');
        pageInfo.endCursor = ensureKey(endCursor$1);
      }
    }

    if (pageInfo.startCursor === null) {
      var edge$1 = edges[0];

      if (edge$1) {
        var startCursor$1 = cache.resolve(edge$1, 'cursor');
        pageInfo.startCursor = ensureKey(startCursor$1);
      }
    }
  }

  return page;
};

var relayPagination = function (params) {
  if (params === void 0) params = {};
  var mergeMode = params.mergeMode || 'inwards';
  return function (_parent, fieldArgs, cache, info) {
    var entityKey = info.parentKey;
    var fieldName = info.fieldName;
    var allFields = cache.inspectFields(entityKey);
    var fieldInfos = allFields.filter(function (info) {
      return info.fieldName === fieldName;
    });
    var size = fieldInfos.length;

    if (size === 0) {
      return undefined;
    }

    var typename = null;
    var startEdges = [];
    var endEdges = [];

    var pageInfo = _extends({}, defaultPageInfo);

    for (var i = 0; i < size; i++) {
      var ref = fieldInfos[i];
      var fieldKey = ref.fieldKey;
      var args = ref.arguments;

      if (args === null || !compareArgs(fieldArgs, args)) {
        continue;
      }

      var page = getPage(cache, entityKey, fieldKey);

      if (page === null) {
        continue;
      }

      if (mergeMode === 'inwards' && typeof args.last === 'number' && typeof args.first === 'number') {
        var firstEdges = page.edges.slice(0, args.first + 1);
        var lastEdges = page.edges.slice(-args.last);
        startEdges = concatEdges(cache, startEdges, firstEdges);
        endEdges = concatEdges(cache, lastEdges, endEdges);
        pageInfo = page.pageInfo;
      } else if (args.after) {
        startEdges = concatEdges(cache, startEdges, page.edges);
        pageInfo.endCursor = page.pageInfo.endCursor;
        pageInfo.hasNextPage = page.pageInfo.hasNextPage;
      } else if (args.before) {
        endEdges = concatEdges(cache, page.edges, endEdges);
        pageInfo.startCursor = page.pageInfo.startCursor;
        pageInfo.hasPreviousPage = page.pageInfo.hasPreviousPage;
      } else if (typeof args.last === 'number') {
        endEdges = concatEdges(cache, endEdges, page.edges);
        pageInfo = page.pageInfo;
      } else {
        startEdges = concatEdges(cache, startEdges, page.edges);
        pageInfo = page.pageInfo;
      }

      if (page.pageInfo.__typename !== pageInfo.__typename) {
        pageInfo.__typename = page.pageInfo.__typename;
      }

      if (typename !== page.__typename) {
        typename = page.__typename;
      }
    }

    if (typeof typename !== 'string') {
      return undefined;
    }

    var hasCurrentPage = !!ensureKey(cache.resolve(entityKey, fieldName, fieldArgs));

    if (!hasCurrentPage) {
      if (info.schemaPredicates === undefined) {
        return undefined;
      } else {
        info.partial = true;
      }
    }

    return {
      __typename: typename,
      edges: mergeMode === 'inwards' ? concatEdges(cache, startEdges, endEdges) : concatEdges(cache, endEdges, startEdges),
      pageInfo: {
        __typename: pageInfo.__typename,
        endCursor: pageInfo.endCursor,
        startCursor: pageInfo.startCursor,
        hasNextPage: pageInfo.hasNextPage,
        hasPreviousPage: pageInfo.hasPreviousPage
      }
    };
  };
};

var simplePagination = function (ref) {
  if (ref === void 0) ref = {};
  var offsetArgument = ref.offsetArgument;
  if (offsetArgument === void 0) offsetArgument = 'skip';
  var limitArgument = ref.limitArgument;
  if (limitArgument === void 0) limitArgument = 'limit';

  var compareArgs = function (fieldArgs, connectionArgs) {
    for (var key in connectionArgs) {
      if (key === offsetArgument || key === limitArgument) {
        continue;
      } else if (!(key in fieldArgs)) {
        return false;
      }

      var argA = fieldArgs[key];
      var argB = connectionArgs[key];

      if (typeof argA !== typeof argB || typeof argA !== 'object' ? argA !== argB : core.stringifyVariables(argA) !== core.stringifyVariables(argB)) {
        return false;
      }
    }

    for (var key$1 in fieldArgs) {
      if (key$1 === offsetArgument || key$1 === limitArgument) {
        continue;
      }

      if (!(key$1 in connectionArgs)) {
        return false;
      }
    }

    return true;
  };

  return function (_parent, fieldArgs, cache, info) {
    var entityKey = info.parentKey;
    var fieldName = info.fieldName;
    var allFields = cache.inspectFields(entityKey);
    var fieldInfos = allFields.filter(function (info) {
      return info.fieldName === fieldName;
    });
    var size = fieldInfos.length;

    if (size === 0) {
      return undefined;
    }

    var visited = new Set();
    var result = [];
    var prevOffset = null;

    for (var i = 0; i < size; i++) {
      var ref = fieldInfos[i];
      var fieldKey = ref.fieldKey;
      var args = ref.arguments;

      if (args === null || !compareArgs(fieldArgs, args)) {
        continue;
      }

      var links = cache.resolveFieldByKey(entityKey, fieldKey);
      var currentOffset = args[offsetArgument];

      if (links === null || links.length === 0 || typeof currentOffset !== 'number') {
        continue;
      }

      if (!prevOffset || currentOffset > prevOffset) {
        for (var j = 0; j < links.length; j++) {
          var link = links[j];

          if (visited.has(link)) {
            continue;
          }

          result.push(link);
          visited.add(link);
        }
      } else {
        var tempResult = [];

        for (var j$1 = 0; j$1 < links.length; j$1++) {
          var link$1 = links[j$1];

          if (visited.has(link$1)) {
            continue;
          }

          tempResult.push(link$1);
          visited.add(link$1);
        }

        result = tempResult.concat(result);
      }

      prevOffset = currentOffset;
    }

    var hasCurrentPage = cache.resolve(entityKey, fieldName, fieldArgs);

    if (hasCurrentPage) {
      return result;
    } else if (info.schemaPredicates === undefined) {
      return undefined;
    } else {
      info.partial = true;
      return result;
    }
  };
};

exports.relayPagination = relayPagination;
exports.simplePagination = simplePagination;
//# sourceMappingURL=urql-exchange-graphcache-extras.js.map
