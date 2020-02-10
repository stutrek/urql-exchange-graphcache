"use strict";

var core = require("urql/core");

function _extends() {
  return (_extends = Object.assign || function(a) {
    for (var e = 1; e < arguments.length; e++) {
      var c, d = arguments[e];
      for (c in d) {
        Object.prototype.hasOwnProperty.call(d, c) && (a[c] = d[c]);
      }
    }
    return a;
  }).apply(this, arguments);
}

var defaultPageInfo = {
  __typename: "PageInfo",
  endCursor: null,
  startCursor: null,
  hasNextPage: !1,
  hasPreviousPage: !1
}, ensureKey = function(a) {
  return "string" == typeof a ? a : null;
}, concatEdges = function(a, e, d) {
  for (var c = new Set, b = 0, g = e.length; b < g; b++) {
    var p = a.resolve(e[b], "node");
    "string" == typeof p && c.add(p);
  }
  e = e.slice();
  b = 0;
  for (g = d.length; b < g; b++) {
    var l = a.resolve(p = d[b], "node");
    "string" != typeof l || c.has(l) || (c.add(l), e.push(p));
  }
  return e;
}, compareArgs = function(a, e) {
  for (var d in e) {
    if ("first" !== d && "last" !== d && "after" !== d && "before" !== d) {
      if (!(d in a)) {
        return !1;
      }
      var c = a[d], b = e[d];
      if (typeof c != typeof b || "object" != typeof c ? c !== b : core.stringifyVariables(c) !== core.stringifyVariables(b)) {
        return !1;
      }
    }
  }
  for (var g in a) {
    if ("first" !== g && "last" !== g && "after" !== g && "before" !== g && !(g in e)) {
      return !1;
    }
  }
  return !0;
}, getPage = function(a, e, d) {
  var c = ensureKey(a.resolveFieldByKey(e, d));
  if (!c) {
    return null;
  }
  e = a.resolve(c, "__typename");
  d = a.resolve(c, "edges") || [];
  if ("string" != typeof e) {
    return null;
  }
  e = {
    __typename: e,
    edges: d,
    pageInfo: defaultPageInfo
  };
  var b = a.resolve(c, "pageInfo");
  if ("string" == typeof b) {
    c = ensureKey(a.resolve(b, "__typename"));
    var g = ensureKey(a.resolve(b, "endCursor")), p = ensureKey(a.resolve(b, "startCursor")), l = a.resolve(b, "hasNextPage");
    b = a.resolve(b, "hasPreviousPage");
    null === (c = e.pageInfo = {
      __typename: "string" == typeof c ? c : "PageInfo",
      hasNextPage: "boolean" == typeof l ? l : !!g,
      hasPreviousPage: "boolean" == typeof b ? b : !!p,
      endCursor: g,
      startCursor: p
    }).endCursor && (g = d[d.length - 1]) && (g = a.resolve(g, "cursor"), c.endCursor = ensureKey(g));
    null === c.startCursor && (d = d[0]) && (a = a.resolve(d, "cursor"), c.startCursor = ensureKey(a));
  }
  return e;
};

exports.relayPagination = function(a) {
  void 0 === a && (a = {});
  var e = a.mergeMode || "inwards";
  return function(a, c, b, g) {
    var d = g.fieldName, l = b.inspectFields(a = g.parentKey).filter((function(b) {
      return b.fieldName === d;
    })), v = l.length;
    if (0 !== v) {
      for (var t = null, q = [], n = [], h = _extends({}, defaultPageInfo), m = 0; m < v; m++) {
        var k = l[m], f = k.fieldKey;
        null !== (k = k.arguments) && compareArgs(c, k) && (null !== (f = getPage(b, a, f)) && ("inwards" === e && "number" == typeof k.last && "number" == typeof k.first ? (h = f.edges.slice(0, k.first + 1), 
        k = f.edges.slice(-k.last), q = concatEdges(b, q, h), n = concatEdges(b, k, n), 
        h = f.pageInfo) : k.after ? (q = concatEdges(b, q, f.edges), h.endCursor = f.pageInfo.endCursor, 
        h.hasNextPage = f.pageInfo.hasNextPage) : k.before ? (n = concatEdges(b, f.edges, n), 
        h.startCursor = f.pageInfo.startCursor, h.hasPreviousPage = f.pageInfo.hasPreviousPage) : ("number" == typeof k.last ? n = concatEdges(b, n, f.edges) : q = concatEdges(b, q, f.edges), 
        h = f.pageInfo), f.pageInfo.__typename !== h.__typename && (h.__typename = f.pageInfo.__typename), 
        t !== f.__typename && (t = f.__typename)));
      }
      if ("string" == typeof t) {
        if (!ensureKey(b.resolve(a, d, c))) {
          if (void 0 === g.schemaPredicates) {
            return;
          }
          g.partial = !0;
        }
        return {
          __typename: t,
          edges: "inwards" === e ? concatEdges(b, q, n) : concatEdges(b, n, q),
          pageInfo: {
            __typename: h.__typename,
            endCursor: h.endCursor,
            startCursor: h.startCursor,
            hasNextPage: h.hasNextPage,
            hasPreviousPage: h.hasPreviousPage
          }
        };
      }
    }
  };
};

exports.simplePagination = function(a) {
  void 0 === a && (a = {});
  var e = a.offsetArgument;
  void 0 === e && (e = "skip");
  var d = a.limitArgument;
  void 0 === d && (d = "limit");
  var c = function(b, a) {
    for (var c in a) {
      if (c !== e && c !== d) {
        if (!(c in b)) {
          return !1;
        }
        var g = b[c], v = a[c];
        if (typeof g != typeof v || "object" != typeof g ? g !== v : core.stringifyVariables(g) !== core.stringifyVariables(v)) {
          return !1;
        }
      }
    }
    for (var t in b) {
      if (t !== e && t !== d && !(t in a)) {
        return !1;
      }
    }
    return !0;
  };
  return function(a, d, p, l) {
    var b = l.fieldName, g = p.inspectFields(a = l.parentKey).filter((function(a) {
      return a.fieldName === b;
    })), q = g.length;
    if (0 !== q) {
      for (var n = new Set, h = [], m = null, k = 0; k < q; k++) {
        var f = g[k], r = f.fieldKey;
        if (null !== (f = f.arguments) && c(d, f) && (r = p.resolveFieldByKey(a, r), f = f[e], 
        null !== r && 0 !== r.length && "number" == typeof f)) {
          if (!m || f > m) {
            for (m = 0; m < r.length; m++) {
              var u = r[m];
              n.has(u) || (h.push(u), n.add(u));
            }
          } else {
            m = [];
            for (u = 0; u < r.length; u++) {
              var w = r[u];
              n.has(w) || (m.push(w), n.add(w));
            }
            h = m.concat(h);
          }
          m = f;
        }
      }
      if (p.resolve(a, b, d)) {
        return h;
      }
      if (void 0 !== l.schemaPredicates) {
        return l.partial = !0, h;
      }
    }
  };
};
//# sourceMappingURL=urql-exchange-graphcache-extras.js.map
