import { stringifyVariables } from "urql/core";

function r() {
  return (r = Object.assign || function(a) {
    for (var d = 1; d < arguments.length; d++) {
      var c, e = arguments[d];
      for (c in e) {
        Object.prototype.hasOwnProperty.call(e, c) && (a[c] = e[c]);
      }
    }
    return a;
  }).apply(this, arguments);
}

var v = {
  __typename: "PageInfo",
  endCursor: null,
  startCursor: null,
  hasNextPage: !1,
  hasPreviousPage: !1
};

function y(a) {
  return "string" == typeof a ? a : null;
}

function A(a, d, e) {
  for (var c = new Set, b = 0, g = d.length; b < g; b++) {
    var p = a.resolve(d[b], "node");
    "string" == typeof p && c.add(p);
  }
  d = d.slice();
  b = 0;
  for (g = e.length; b < g; b++) {
    var l = a.resolve(p = e[b], "node");
    "string" != typeof l || c.has(l) || (c.add(l), d.push(p));
  }
  return d;
}

function B(a, d) {
  for (var e in d) {
    if ("first" !== e && "last" !== e && "after" !== e && "before" !== e) {
      if (!(e in a)) {
        return !1;
      }
      var c = a[e], b = d[e];
      if (typeof c != typeof b || "object" != typeof c ? c !== b : stringifyVariables(c) !== stringifyVariables(b)) {
        return !1;
      }
    }
  }
  for (var g in a) {
    if ("first" !== g && "last" !== g && "after" !== g && "before" !== g && !(g in d)) {
      return !1;
    }
  }
  return !0;
}

function C(a, d, e) {
  var c = y(a.resolveFieldByKey(d, e));
  if (!c) {
    return null;
  }
  d = a.resolve(c, "__typename");
  e = a.resolve(c, "edges") || [];
  if ("string" != typeof d) {
    return null;
  }
  d = {
    __typename: d,
    edges: e,
    pageInfo: v
  };
  var b = a.resolve(c, "pageInfo");
  if ("string" == typeof b) {
    c = y(a.resolve(b, "__typename"));
    var g = y(a.resolve(b, "endCursor")), p = y(a.resolve(b, "startCursor")), l = a.resolve(b, "hasNextPage");
    b = a.resolve(b, "hasPreviousPage");
    null === (c = d.pageInfo = {
      __typename: "string" == typeof c ? c : "PageInfo",
      hasNextPage: "boolean" == typeof l ? l : !!g,
      hasPreviousPage: "boolean" == typeof b ? b : !!p,
      endCursor: g,
      startCursor: p
    }).endCursor && (g = e[e.length - 1]) && (g = a.resolve(g, "cursor"), c.endCursor = y(g));
    null === c.startCursor && (e = e[0]) && (a = a.resolve(e, "cursor"), c.startCursor = y(a));
  }
  return d;
}

var relayPagination = function(a) {
  void 0 === a && (a = {});
  var d = a.mergeMode || "inwards";
  return function(a, c, b, g) {
    var e = g.fieldName, l = b.inspectFields(a = g.parentKey).filter((function(b) {
      return b.fieldName === e;
    })), x = l.length;
    if (0 !== x) {
      for (var u = null, q = [], n = [], h = r({}, v), m = 0; m < x; m++) {
        var k = l[m], f = k.fieldKey;
        null !== (k = k.arguments) && B(c, k) && (null !== (f = C(b, a, f)) && ("inwards" === d && "number" == typeof k.last && "number" == typeof k.first ? (h = f.edges.slice(0, k.first + 1), 
        k = f.edges.slice(-k.last), q = A(b, q, h), n = A(b, k, n), h = f.pageInfo) : k.after ? (q = A(b, q, f.edges), 
        h.endCursor = f.pageInfo.endCursor, h.hasNextPage = f.pageInfo.hasNextPage) : k.before ? (n = A(b, f.edges, n), 
        h.startCursor = f.pageInfo.startCursor, h.hasPreviousPage = f.pageInfo.hasPreviousPage) : ("number" == typeof k.last ? n = A(b, n, f.edges) : q = A(b, q, f.edges), 
        h = f.pageInfo), f.pageInfo.__typename !== h.__typename && (h.__typename = f.pageInfo.__typename), 
        u !== f.__typename && (u = f.__typename)));
      }
      if ("string" == typeof u) {
        if (!y(b.resolve(a, e, c))) {
          if (void 0 === g.schemaPredicates) {
            return;
          }
          g.partial = !0;
        }
        return {
          __typename: u,
          edges: "inwards" === d ? A(b, q, n) : A(b, n, q),
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

var simplePagination = function(a) {
  function d(b, a) {
    for (var d in a) {
      if (d !== e && d !== c) {
        if (!(d in b)) {
          return !1;
        }
        var g = b[d], x = a[d];
        if (typeof g != typeof x || "object" != typeof g ? g !== x : stringifyVariables(g) !== stringifyVariables(x)) {
          return !1;
        }
      }
    }
    for (var u in b) {
      if (u !== e && u !== c && !(u in a)) {
        return !1;
      }
    }
    return !0;
  }
  void 0 === a && (a = {});
  var e = a.offsetArgument;
  void 0 === e && (e = "skip");
  var c = a.limitArgument;
  void 0 === c && (c = "limit");
  return function(a, c, p, l) {
    var b = l.fieldName, g = p.inspectFields(a = l.parentKey).filter((function(a) {
      return a.fieldName === b;
    })), q = g.length;
    if (0 !== q) {
      for (var n = new Set, h = [], m = null, k = 0; k < q; k++) {
        var f = g[k], t = f.fieldKey;
        if (null !== (f = f.arguments) && d(c, f) && (t = p.resolveFieldByKey(a, t), f = f[e], 
        null !== t && 0 !== t.length && "number" == typeof f)) {
          if (!m || f > m) {
            for (m = 0; m < t.length; m++) {
              var w = t[m];
              n.has(w) || (h.push(w), n.add(w));
            }
          } else {
            m = [];
            for (w = 0; w < t.length; w++) {
              var z = t[w];
              n.has(z) || (m.push(z), n.add(z));
            }
            h = m.concat(h);
          }
          m = f;
        }
      }
      if (p.resolve(a, b, c)) {
        return h;
      }
      if (void 0 !== l.schemaPredicates) {
        return l.partial = !0, h;
      }
    }
  };
};

export { relayPagination, simplePagination };
//# sourceMappingURL=urql-exchange-graphcache-extras.es.js.map
