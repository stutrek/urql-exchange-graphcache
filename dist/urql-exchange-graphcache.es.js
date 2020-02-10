import { share, mergeMap, fromArray, take, buffer, fromPromise, empty, tap, map, concat, filter, merge } from "wonka";

import { stringifyVariables, createRequest, formatDocument } from "urql/core";

import { isWrappingType, Kind, valueFromASTUntyped, buildClientSchema, isNullableType, isNonNullType, isListType, GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, visit, visitWithTypeInfo, TypeInfo, isCompositeType, isAbstractType } from "graphql";

import { observable, action } from "mobx";

function q() {
  return (q = Object.assign || function(a) {
    for (var b = 1; b < arguments.length; b++) {
      var d, c = arguments[b];
      for (d in c) {
        Object.prototype.hasOwnProperty.call(c, d) && (a[d] = c[d]);
      }
    }
    return a;
  }).apply(this, arguments);
}

function r(a) {
  return a.name.value;
}

function t(a) {
  return void 0 !== a.alias ? a.alias.value : r(a);
}

function u(a) {
  return void 0 !== a.selectionSet ? a.selectionSet.selections : [];
}

function aa(a) {
  return void 0 !== (a = a.typeCondition) ? r(a) : null;
}

function ba(a) {
  return isWrappingType(a) ? ba(a.ofType) : a || null;
}

var ca = new Set, y = [];

function z(a, b) {
  var c = "";
  b.kind === Kind.INLINE_FRAGMENT ? c = a ? 'Inline Fragment on "' + a + '"' : "Inline Fragment" : b.kind === Kind.OPERATION_DEFINITION ? c = (b.name ? '"' + b.name.value + '"' : "Unnamed") + " " + b.operation : b.kind === Kind.FRAGMENT_DEFINITION && (c = '"' + b.name.value + '" Fragment');
  c && y.push(c);
}

function da() {
  return y.length ? "\n(Caused At: " + y.join(", ") + ")" : "";
}

function A(a, b, c) {
  if (!a) {
    throw a = b || "Minfied Error #" + c + "\n", "production" !== process.env.NODE_ENV && (a += da()), 
    (c = Error(a + "\nhttps://github.com/FormidableLabs/urql-exchange-graphcache/blob/master/docs/help.md#" + c)).name = "Graphcache Error", 
    c;
  }
}

function B(a, b) {
  ca.has(a) || (console.warn(a + da() + "\nhttps://github.com/FormidableLabs/urql-exchange-graphcache/blob/master/docs/help.md#" + b), 
  ca.add(a));
}

function E(a, b) {
  return b ? a + "(" + stringifyVariables(b) + ")" : a;
}

function ea(a) {
  var b = a.indexOf("(");
  return -1 < b ? {
    fieldKey: a,
    fieldName: a.slice(0, b),
    arguments: JSON.parse(a.slice(b + 1, -1))
  } : {
    fieldKey: a,
    fieldName: a,
    arguments: null
  };
}

var fa = "production" === process.env.NODE_ENV && "undefined" != typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : function(a) {
  return setTimeout(a, 0);
};

function F() {
  return observable({});
}

var G = null, H = null, J = null;

function ha() {
  return {
    optimistic: F(),
    base: new Map,
    keys: []
  };
}

function K(a, b) {
  window.currentData = G = a;
  H = new Set;
  J = b;
  "production" !== process.env.NODE_ENV && (y.length = 0);
}

function L() {
  var c = G;
  !c.gcScheduled && 0 < c.gcBatch.size && (c.gcScheduled = !0, fa((function a() {
    ia(c);
  })));
  c.storage && !c.persistenceScheduled && (c.persistenceScheduled = !0, fa((function b() {
    c.storage.write(c.persistenceBatch);
    c.persistenceScheduled = !1;
    c.persistenceBatch = F();
  })));
  J = H = G = null;
  "production" !== process.env.NODE_ENV && (y.length = 0);
}

function M() {
  A(null !== H, "production" !== process.env.NODE_ENV ? "Invalid Cache call: The cache may only be accessed or mutated duringoperations like write or query, or as part of its resolvers, updaters, or optimistic configs." : "", 2);
  return H;
}

function ka(a, b, c, d) {
  J ? (void 0 === a.optimistic[J] && (a.optimistic[J] = new Map, a.keys.unshift(J)), 
  a = a.optimistic[J]) : a = a.base;
  var e = a.get(b);
  void 0 === e && a.set(b, e = F());
  void 0 !== d || J ? e[c] = d : delete e[c];
}

function la(a, b, c) {
  for (var d = 0, e = a.keys.length; d < e; d++) {
    var f = a.optimistic[a.keys[d]].get(b);
    if (void 0 !== f && c in f) {
      return f[c];
    }
  }
  return void 0 !== (a = a.base.get(b)) ? a[c] : void 0;
}

function ma(a, b) {
  var c = a.keys.indexOf(b);
  -1 < c && (delete a.optimistic[b], a.keys.splice(c, 1));
}

function na(a, b, c, d) {
  var e = void 0 !== b[c] ? b[c] : 0;
  b = b[c] = e + d | 0;
  void 0 !== a && (0 >= b ? a.add(c) : 0 >= e && 0 < b && a.delete(c));
}

function ra(a, b, c, d) {
  if ("string" == typeof c) {
    na(a, b, c, d);
  } else if (Array.isArray(c)) {
    for (var e = 0, f = c.length; e < f; e++) {
      var g = c[e];
      g && na(a, b, g, d);
    }
  }
}

function sa(a, b, c) {
  if (void 0 !== c) {
    for (var d in c) {
      b.has(d) || (a.push(ea(d)), b.add(d));
    }
  }
}

function ta(a, b, c, d) {
  sa(a, b, d.base.get(c));
  for (var e = 0, f = d.keys.length; e < f; e++) {
    sa(a, b, d.optimistic[d.keys[e]].get(c));
  }
}

function ia(a) {
  a.gcScheduled = !1;
  a.gcBatch.forEach((function(b) {
    if (0 >= (a.refCount[b] || 0)) {
      for (var c in a.refLock) {
        var d = a.refLock[c];
        if (0 < (d[b] || 0)) {
          return;
        }
        delete d[b];
      }
      delete a.refCount[b];
      a.gcBatch.delete(b);
      if (void 0 !== (c = a.records.base.get(b)) && (a.records.base.delete(b), a.storage)) {
        for (var e in c) {
          a.persistenceBatch["r|" + b + "." + e] = void 0;
        }
      }
      if (void 0 !== (e = a.links.base.get(b))) {
        a.links.base.delete(b);
        for (var f in e) {
          a.storage && (a.persistenceBatch["l|" + b + "." + f] = void 0), ra(a.gcBatch, a.refCount, e[f], -1);
        }
      }
    } else {
      a.gcBatch.delete(b);
    }
  }));
}

function N(a, b) {
  "__typename" !== b && (a !== G.queryRootKey ? H.add(a) : void 0 !== b && H.add(a + "." + b));
}

function O(a, b) {
  N(a, b);
  return la(G.records, a, b);
}

function P(a, b) {
  N(a, b);
  return la(G.links, a, b);
}

function S(a, b, c) {
  N(a, b);
  ka(G.records, a, b, c);
  G.storage && !J && (G.persistenceBatch["r|" + a + "." + b] = c);
}

function va(a, b, c) {
  var d = G;
  if (J) {
    var e = d.refLock[J] || (d.refLock[J] = F());
    var f = d.links.optimistic[J];
  } else {
    d.storage && (d.persistenceBatch["l|" + a + "." + b] = c);
    e = d.refCount;
    f = d.links.base;
    var g = d.gcBatch;
  }
  f = void 0 !== (f = void 0 !== f ? f.get(a) : void 0) ? f[b] : null;
  N(a, b);
  ka(d.links, a, b, c);
  ra(g, e, f, -1);
  ra(g, e, c, 1);
}

function wa(a, b, c, d) {
  if (!b) {
    return !1;
  }
  var e = aa(a);
  if (b === e) {
    return !0;
  }
  "production" !== process.env.NODE_ENV && B("Heuristic Fragment Matching: A fragment is trying to match against the `" + b + "` type, but the type condition is `" + e + "`. Since GraphQL allows for interfaces `" + e + "` may be aninterface.\nA schema needs to be defined for this match to be deterministic, otherwise the fragment will be matched heuristically!", 16);
  return !u(a).some((function(a) {
    if (a.kind !== Kind.FIELD) {
      return !1;
    }
    a = E(r(a), T(a, d.variables));
    return !(void 0 !== O(c, a) || void 0 !== P(c, a));
  }));
}

function U(a, b, c, d) {
  this.typename = a;
  this.entityKey = b;
  this.context = d;
  this.indexStack = [ 0 ];
  this.selectionStack = [ c ];
}

U.prototype.next = function() {
  for (;0 !== this.indexStack.length; ) {
    var a = this.indexStack[this.indexStack.length - 1]++, b = this.selectionStack[this.selectionStack.length - 1];
    if (a >= b.length) {
      this.indexStack.pop(), this.selectionStack.pop();
    } else {
      a = b[a];
      a: {
        b = this.context.variables;
        var c = a.directives;
        if (void 0 !== c) {
          for (var d = 0, e = c.length; d < e; d++) {
            var f = c[d], g = r(f), h = "include" === g;
            if ((h || "skip" === g) && (f = f.arguments ? f.arguments[0] : null) && "if" === r(f) && ("boolean" == typeof (f = valueFromASTUntyped(f.value, b)) || null === f)) {
              b = h ? !!f : !f;
              break a;
            }
          }
        }
        b = !0;
      }
      if (b) {
        if (a.kind !== Kind.FIELD) {
          if (void 0 !== (a = a.kind !== Kind.INLINE_FRAGMENT ? this.context.fragments[r(a)] : a) && ("production" !== process.env.NODE_ENV && z(this.typename, a), 
          void 0 !== this.context.schemaPredicates ? this.context.schemaPredicates.isInterfaceOfType(aa(a), this.typename) : wa(a, this.typename, this.entityKey, this.context))) {
            this.indexStack.push(0), this.selectionStack.push(u(a));
          }
        } else if ("__typename" !== r(a)) {
          return a;
        }
      }
    }
  }
};

function V(a) {
  return void 0 === a ? null : a;
}

function xa(a, b, c) {
  K(a.data, 0);
  a = ya(a, b, c);
  L();
  return a;
}

function ya(a, b, c) {
  var d = za(b.query), e = {
    dependencies: M()
  }, f = u(d), g = a.getRootKey(d.operation);
  a = {
    parentTypeName: g,
    parentKey: g,
    parentFieldKey: "",
    fieldName: "",
    variables: Aa(d, b.variables),
    fragments: W(b.query),
    result: e,
    store: a,
    schemaPredicates: a.schemaPredicates
  };
  "production" !== process.env.NODE_ENV && z(g, d);
  g === a.store.getRootKey("query") ? Ba(a, g, f, c) : Ca(a, g, f, c);
  return e;
}

function Da(a, b, c) {
  K(a.data, c);
  var d = za(b.query);
  c = {
    dependencies: M()
  };
  var e = a.getRootKey("mutation"), f = a.getRootKey(d.operation);
  A(f === e, "production" !== process.env.NODE_ENV ? "writeOptimistic(...) was called with an operation that is not a mutation.\nThis case is unsupported and should never occur." : "", 10);
  "production" !== process.env.NODE_ENV && z(f, d);
  a = {
    parentTypeName: e,
    parentKey: e,
    parentFieldKey: "",
    fieldName: "",
    variables: Aa(d, b.variables),
    fragments: W(b.query),
    result: c,
    store: a,
    schemaPredicates: a.schemaPredicates,
    optimistic: !0
  };
  b = F();
  d = new U(f, f, u(d), a);
  for (var g; void 0 !== (g = d.next()); ) {
    if (void 0 !== g.selectionSet) {
      var h = r(g), k = a.store.optimisticMutations[h];
      if (void 0 !== k) {
        a.fieldName = h;
        Ea(a, V(k = k((f = T(g, a.variables)) || F(), a.store, a)), u(g));
        b[h] = k;
        void 0 !== (g = a.store.updates[e][h]) && g(b, f || F(), a.store, a);
      }
    }
  }
  L();
  return c;
}

function Fa(a, b, c, d) {
  b = W(b);
  var e = Object.keys(b);
  if (void 0 === (e = b[e[0]])) {
    return "production" !== process.env.NODE_ENV ? B("writeFragment(...) was called with an empty fragment.\nYou have to call it with at least one fragment in your GraphQL document.", 11) : void 0;
  }
  var f = e.typeCondition.name.value;
  c = q({
    __typename: f
  }, c);
  var g = a.keyOfEntity(c);
  if (!g) {
    return "production" !== process.env.NODE_ENV ? B("Can't generate a key for writeFragment(...) data.\nYou have to pass an `id` or `_id` field or create a custom `keys` config for `" + f + "`.", 12) : void 0;
  }
  "production" !== process.env.NODE_ENV && z(f, e);
  Ba(a = {
    parentTypeName: f,
    parentKey: g,
    parentFieldKey: "",
    fieldName: "",
    variables: d || {},
    fragments: b,
    result: {
      dependencies: M()
    },
    store: a,
    schemaPredicates: a.schemaPredicates
  }, g, u(e), c);
}

function Ba(a, b, c, d) {
  var e = b === a.store.getRootKey("query") ? b : d.__typename;
  if ("string" == typeof e) {
    S(b, "__typename", e);
    c = new U(e, b, c, a);
    for (var f; void 0 !== (f = c.next()); ) {
      var g = r(f), h = T(f, a.variables);
      h = E(g, h);
      var k = d[t(f)], l = b + "." + h;
      if ("production" !== process.env.NODE_ENV) {
        if (void 0 === k) {
          g = a.optimistic ? "\nYour optimistic result may be missing a field!" : "";
          f = void 0 === f.selectionSet ? "scalar (number, boolean, etc)" : "selection set";
          "production" !== process.env.NODE_ENV && B("Invalid undefined: The field at `" + h + "` is `undefined`, but the GraphQL query expects a " + f + " for this field." + g, 13);
          continue;
        } else {
          a.schemaPredicates && e && a.schemaPredicates.isFieldAvailableOnType(e, g);
        }
      }
      void 0 === f.selectionSet ? S(b, h, k) : (g = V(k), va(b, h, f = Ga(a, l, u(f), g)));
    }
  }
}

function Ga(a, b, c, d) {
  if (Array.isArray(d)) {
    for (var e = Array(d.length), f = 0, g = d.length; f < g; f++) {
      var h = Ga(a, b + "." + f, c, d[f]);
      e[f] = h;
    }
    return e;
  }
  if (null === d) {
    return null;
  }
  f = null !== (e = a.store.keyOfEntity(d)) ? e : b;
  g = d.__typename;
  void 0 !== a.store.keys[d.__typename] || null !== e || "string" != typeof g || g.endsWith("Connection") || g.endsWith("Edge") || "PageInfo" === g || "production" !== process.env.NODE_ENV && B("Invalid key: The GraphQL query at the field at `" + b + "` has a selection set, but no key could be generated for the data at this field.\nYou have to request `id` or `_id` fields for all selection sets or create a custom `keys` config for `" + g + "`.\nEntities without keys will be embedded directly on the parent entity. If this is intentional, create a `keys` config for `" + g + "` that always returns null.", 15);
  Ba(a, f, c, d);
  return f;
}

function Ca(a, b, c, d) {
  var e = b === a.store.getRootKey("mutation") || b === a.store.getRootKey("subscription");
  c = new U(b, b, c, a);
  for (var f; void 0 !== (f = c.next()); ) {
    var g = r(f), h = T(f, a.variables);
    var k = E(g, h);
    k = b + "." + k;
    if (void 0 !== f.selectionSet) {
      Ea(a, V(d[t(f)]), u(f));
    }
    e && (a.parentTypeName = b, a.parentKey = b, a.parentFieldKey = k, a.fieldName = g, 
    void 0 !== (f = a.store.updates[b][g]) && f(d, h || F(), a.store, a));
  }
}

function Ea(a, b, c) {
  if (Array.isArray(b)) {
    for (var d = Array(b.length), e = 0, f = b.length; e < f; e++) {
      d[e] = Ea(a, b[e], c);
    }
    return d;
  }
  null !== b && (null !== (d = a.store.keyOfEntity(b)) ? Ba(a, d, c, b) : Ca(a, b.__typename, c, b));
}

function X(a, b, c, d, e) {
  var g, f = this;
  this.gcScheduled = !1;
  this.gc = function() {
    ia(f.data);
    f.gcScheduled = !1;
  };
  this.keyOfField = E;
  this.resolvers = b || {};
  this.optimisticMutations = d || {};
  this.keys = e || {};
  this.schemaPredicates = a;
  this.updates = {
    Mutation: c && c.Mutation || {},
    Subscription: c && c.Subscription || {}
  };
  a ? (c = (b = a.schema).getQueryType(), a = b.getMutationType(), b = b.getSubscriptionType(), 
  this.rootFields = {
    query: c = c ? c.name : "Query",
    mutation: a = a ? a.name : "Mutation",
    subscription: b = b ? b.name : "Subscription"
  }, this.rootNames = ((g = {})[c] = "query", g[a] = "mutation", g[b] = "subscription", 
  g)) : (this.rootFields = {
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription"
  }, this.rootNames = {
    Query: "query",
    Mutation: "mutation",
    Subscription: "subscription"
  });
  this.data = function ja(a) {
    return {
      persistenceScheduled: !1,
      persistenceBatch: F(),
      gcScheduled: !1,
      queryRootKey: a,
      gcBatch: new Set,
      refCount: F(),
      refLock: F(),
      links: ha(),
      records: ha(),
      storage: null
    };
  }(this.getRootKey("query"));
}

X.prototype.getRootKey = function(a) {
  return this.rootFields[a];
};

X.prototype.keyOfEntity = function(a) {
  var b = a.__typename, c = a.id, d = a._id;
  if (!b) {
    return null;
  }
  if (void 0 !== this.rootNames[b]) {
    return b;
  }
  var e;
  this.keys[b] ? e = this.keys[b](a) : null != c ? e = "" + c : null != d && (e = "" + d);
  return e ? b + ":" + e : null;
};

X.prototype.resolveFieldByKey = function(a, b) {
  if (null === (a = null !== a && "string" != typeof a ? this.keyOfEntity(a) : a)) {
    return null;
  }
  var c = O(a, b);
  return void 0 !== c ? c : (b = P(a, b)) ? b : null;
};

X.prototype.resolve = function(a, b, c) {
  return this.resolveFieldByKey(a, E(b, c));
};

X.prototype.invalidateQuery = function(a, b) {
  !function Ha(a, b, c) {
    if ("Query" !== b) {
      var d = O(b, "__typename");
      if ("string" != typeof d) {
        return;
      }
      S(b, "__typename", void 0);
    } else {
      d = b;
    }
    c = new U(d, b, c, a);
    for (var e; void 0 !== (e = c.next()); ) {
      var f = r(e), g = E(f, T(e, a.variables));
      "production" !== process.env.NODE_ENV && a.schemaPredicates && d && a.schemaPredicates.isFieldAvailableOnType(d, f);
      if (void 0 === e.selectionSet) {
        S(b, g, void 0);
      } else if (e = u(e), f = P(b, g), va(b, g, void 0), S(b, g, void 0), Array.isArray(f)) {
        g = 0;
        for (var h = f.length; g < h; g++) {
          var k = f[g];
          null !== k && Ha(a, k, e);
        }
      } else {
        f && Ha(a, f, e);
      }
    }
  }(b = {
    variables: Aa(a = za((b = createRequest(a, b)).query), b.variables),
    fragments: W(b.query),
    store: this,
    schemaPredicates: this.schemaPredicates
  }, b.store.getRootKey("query"), u(a));
};

X.prototype.inspectFields = function(a) {
  if (null !== (a = null !== a && "string" != typeof a ? this.keyOfEntity(a) : a)) {
    var b = G.links, c = G.records, d = [], e = new Set;
    N(a);
    ta(d, e, a, b);
    ta(d, e, a, c);
    a = d;
  } else {
    a = [];
  }
  return a;
};

X.prototype.updateQuery = function(a, b) {
  a = createRequest(a.query, a.variables);
  null !== (b = b(this.readQuery(a))) && ya(this, a, b);
};

X.prototype.readQuery = function(a) {
  return Ia(this, createRequest(a.query, a.variables)).data;
};

X.prototype.readFragment = function(a, b, c) {
  a = W(a);
  var d = Object.keys(a);
  if (void 0 === (d = a[d[0]])) {
    "production" !== process.env.NODE_ENV && B("readFragment(...) was called with an empty fragment.\nYou have to call it with at least one fragment in your GraphQL document.", 6), 
    c = null;
  } else {
    var e = d.typeCondition.name.value;
    "string" == typeof b || b.__typename || (b.__typename = e);
    (b = "string" != typeof b ? this.keyOfEntity(q({
      __typename: e
    }, b)) : b) ? ("production" !== process.env.NODE_ENV && z(e, d), c = Y({
      parentTypeName: e,
      parentKey: b,
      parentFieldKey: "",
      fieldName: "",
      variables: c || {},
      fragments: a,
      partial: !1,
      store: this,
      schemaPredicates: this.schemaPredicates
    }, b, u(d), F()) || null) : ("production" !== process.env.NODE_ENV && B("Can't generate a key for readFragment(...).\nYou have to pass an `id` or `_id` field or create a custom `keys` config for `" + e + "`.", 7), 
    c = null);
  }
  return c;
};

X.prototype.writeFragment = function(a, b, c) {
  Fa(this, a, b, c);
};

function T(a, b) {
  if (void 0 === a.arguments || 0 === a.arguments.length) {
    return null;
  }
  for (var c = F(), d = 0, e = 0, f = a.arguments.length; e < f; e++) {
    var g = a.arguments[e], h = valueFromASTUntyped(g.value, b);
    null != h && (c[r(g)] = h, d++);
  }
  return 0 < d ? c : null;
}

function Aa(a, b) {
  if (void 0 === a.variableDefinitions) {
    return {};
  }
  var c = b || {};
  return a.variableDefinitions.reduce((function(a, b) {
    var d = r(b.variable), e = c[d];
    if (void 0 === e) {
      if (void 0 !== b.defaultValue) {
        e = valueFromASTUntyped(b.defaultValue, c);
      } else {
        return a;
      }
    }
    a[d] = e;
    return a;
  }), F());
}

function Z(a) {
  this.schema = buildClientSchema(a);
}

Z.prototype.isFieldNullable = function(a, b) {
  return void 0 === (a = Ja(this.schema, a, b)) ? !1 : isNullableType(a.type);
};

Z.prototype.isListNullable = function(a, b) {
  if (void 0 === (a = Ja(this.schema, a, b))) {
    return !1;
  }
  a = isNonNullType(a.type) ? a.type.ofType : a.type;
  return isListType(a) && isNullableType(a.ofType);
};

Z.prototype.isFieldAvailableOnType = function(a, b) {
  return !!Ja(this.schema, a, b);
};

Z.prototype.isInterfaceOfType = function(a, b) {
  if (!b || !a) {
    return !1;
  }
  if (b === a) {
    return !0;
  }
  var c = this.schema.getType(a), d = this.schema.getType(b);
  if (c instanceof GraphQLObjectType) {
    return c === d;
  }
  A(c instanceof GraphQLInterfaceType || c instanceof GraphQLUnionType, "production" !== process.env.NODE_ENV ? "Invalid Abstract type: The type `" + a + "` is not an Interface or Union type in the defined schema, but a fragment in the GraphQL document is using it as a type condition." : "", 5);
  Ka(d, b);
  return this.schema.isPossibleType(c, d);
};

function Ja(a, b, c) {
  Ka(a = a.getType(b), b);
  if (void 0 === (a = a.getFields()[c])) {
    "production" !== process.env.NODE_ENV && B("Invalid field: The field `" + c + "` does not exist on `" + b + "`, but the GraphQL document expects it to exist.\nTraversal will continue, however this may lead to undefined behavior!", 4);
  } else {
    return a;
  }
}

function Ka(a, b) {
  A(a instanceof GraphQLObjectType, "production" !== process.env.NODE_ENV ? "Invalid Object type: The type `" + b + "` is not an object in the defined schema, but the GraphQL document is traversing it." : "", 3);
}

function La(a) {
  return a.kind === Kind.FRAGMENT_DEFINITION;
}

function Ma(a) {
  return a.kind === Kind.OPERATION_DEFINITION;
}

function za(a) {
  A(!!(a = a.definitions.find(Ma)), "production" !== process.env.NODE_ENV ? "Invalid GraphQL document: All GraphQL documents must contain an OperationDefinitionnode for a query, subscription, or mutation." : "", 1);
  return a;
}

function Na(a, b) {
  a[r(b)] = b;
  return a;
}

function W(a) {
  return a.definitions.filter(La).reduce(Na, {});
}

function Pa(a, b, c) {
  K(a.data, 0);
  return Ia(a, b, c);
}

function Ia(a, b, c) {
  var d = za(b.query), e = a.getRootKey(d.operation), f = u(d);
  a = {
    parentTypeName: e,
    parentKey: e,
    parentFieldKey: "",
    fieldName: "",
    variables: Aa(d, b.variables),
    fragments: W(b.query),
    partial: !1,
    store: a,
    schemaPredicates: a.schemaPredicates
  };
  "production" !== process.env.NODE_ENV && z(e, d);
  c = c || F();
  c = e !== a.store.getRootKey("query") ? Qa(a, e, f, c) : Y(a, e, f, c);
  return {
    dependencies: M(),
    partial: void 0 === c ? !1 : a.partial,
    data: void 0 === c ? null : c
  };
}

function Qa(a, b, c, d) {
  if ("string" != typeof d.__typename) {
    return d;
  }
  b = new U(b, b, c, a);
  (c = F()).__typename = d.__typename;
  for (var e; void 0 !== (e = b.next()); ) {
    var f = t(e), g = d[f];
    void 0 !== e.selectionSet && null !== g ? (g = V(g), c[f] = Ra(a, u(e), g)) : c[f] = g;
  }
  return c;
}

function Ra(a, b, c) {
  if (Array.isArray(c)) {
    for (var d = Array(c.length), e = 0, f = c.length; e < f; e++) {
      d[e] = Ra(a, b, c[e]);
    }
    return d;
  }
  if (null === c) {
    return null;
  }
  return null !== (d = a.store.keyOfEntity(c)) ? void 0 === (a = Y(a, d, b, F())) ? null : a : Qa(a, c.__typename, b, c);
}

var Y = action((function(a, b, c, d) {
  var e = a.store, f = a.schemaPredicates, g = b === e.getRootKey("query"), h = g ? b : O(b, "__typename");
  if ("string" == typeof h) {
    d.__typename = h;
    c = new U(h, b, c, a);
    for (var k, l = !1, n = !1, m = function() {
      var m = r(k), p = T(k, a.variables), v = t(k), w = E(m, p), R = O(b, w), oa = function ua(a, b) {
        N(a, b);
        a: {
          for (var c = G.records, d = 0, e = c.keys.length; d < e; d++) {
            var f = c.optimistic[c.keys[d]].get(a);
            if (void 0 !== f && b in f) {
              a = f;
              break a;
            }
          }
          a = void 0 !== (a = c.base.get(a)) ? a : void 0;
        }
        return a;
      }(b, w), Oa = b + "." + w, pa = !1;
      "production" !== process.env.NODE_ENV && f && h && f.isFieldAvailableOnType(h, m);
      var D = void 0, qa = e.resolvers[h];
      if (void 0 !== qa && "function" == typeof qa[m]) {
        if (a.parentTypeName = h, a.parentKey = b, a.parentFieldKey = Oa, a.fieldName = m, 
        void 0 !== R && (d[v] = R), D = qa[m](d, p || F(), e, a), void 0 !== k.selectionSet && (D = function Ta(a, b, c, d, e, f, g) {
          if (Array.isArray(g)) {
            var h = a.schemaPredicates;
            h = void 0 === h || h.isListNullable(b, c);
            for (var k = Array(g.length), l = 0, n = g.length; l < n; l++) {
              var m = Ta(a, b, c, d + "." + l, e, void 0 !== f ? f[l] : void 0, g[l]);
              if (void 0 !== m || h) {
                k[l] = void 0 !== m ? m : null;
              } else {
                return;
              }
            }
            return k;
          }
          if (null == g) {
            return g;
          }
          if ("string" == typeof g || "object" == typeof g && "string" == typeof g.__typename) {
            b = void 0 === f ? F() : f;
            if ("string" == typeof g) {
              a = Y(a, g, e, b);
            } else {
              a: if (c = a.schemaPredicates, d = a.store.keyOfEntity(g) || d, h = g.__typename, 
              f = O(d, "__typename") || h, "string" != typeof f || h && f !== h) {
                "production" !== process.env.NODE_ENV && B("Invalid resolver data: The resolver at `" + d + "` returned an invalid typename that could not be reconciled with the cache.", 8), 
                a = void 0;
              } else {
                b.__typename = f;
                e = new U(f, d, e, a);
                for (l = k = !1; void 0 !== (h = e.next()); ) {
                  n = r(h);
                  m = t(h);
                  var p = E(n, T(h, a.variables)), Q = d + "." + p, I = O(d, p), C = g[n];
                  "production" !== process.env.NODE_ENV && c && f && c.isFieldAvailableOnType(f, n);
                  var x = void 0;
                  void 0 !== C && void 0 === h.selectionSet ? x = C : void 0 === h.selectionSet ? x = I : void 0 !== C ? x = Ta(a, f, n, Q, u(h), b[m], C) : void 0 !== (p = P(d, p)) ? x = Sa(a, p, f, n, u(h), b[m]) : "object" == typeof I && null !== I && (x = I);
                  if (void 0 === x && void 0 !== c && c.isFieldNullable(f, n)) {
                    l = !0, b[m] = null;
                  } else if (void 0 === x) {
                    a = void 0;
                    break a;
                  } else {
                    k = !0, b[m] = x;
                  }
                }
                l && (a.partial = !0);
                a = k ? b : void 0;
              }
            }
            return a;
          }
          "production" !== process.env.NODE_ENV && B("Invalid resolver value: The field at `" + d + "` is a scalar (number, boolean, etc), but the GraphQL query expects a selection set for this field.", 9);
        }(a, h, m, Oa, u(k), d[v] || F(), D)), void 0 !== f && null === D && !f.isFieldNullable(h, m)) {
          return {
            v: void 0
          };
        }
      } else if (void 0 === k.selectionSet) {
        D = R, pa = !0, void 0 === d[v] && Object.defineProperty(d, v, {
          get: function c() {
            return null != oa ? oa[v] : void 0;
          }
        });
      } else if (void 0 !== (p = P(b, w))) {
        if (D = Sa(a, p, h, m, u(k), d[v]), void 0 === d[v]) {
          pa = !0;
          var Za = k, Ya = h;
          Object.defineProperty(d, v, {
            get: function g() {
              var c = P(b, w);
              if (c) {
                return null != (c = Sa(a, c, Ya, m, u(Za), void 0)) ? c : void 0;
              }
            }
          });
        }
      } else {
        "object" == typeof R && null !== R && (D = R);
      }
      if (void 0 === D && void 0 !== f && f.isFieldNullable(h, m)) {
        n = !0, d[v] = null;
      } else {
        if (void 0 === D) {
          return {
            v: void 0
          };
        }
        l = !0;
        !1 === pa && (d[v] = D);
      }
    }; void 0 !== (k = c.next()); ) {
      var p = m();
      if (p) {
        return p.v;
      }
    }
    n && (a.partial = !0);
    return g && n && !l ? void 0 : d;
  }
}));

function Sa(a, b, c, d, e, f) {
  if (Array.isArray(b)) {
    var g = a.schemaPredicates;
    g = void 0 !== g && g.isListNullable(c, d);
    for (var h = Array(b.length), k = 0, l = b.length; k < l; k++) {
      var n = Sa(a, b[k], c, d, e, void 0 !== f ? f[k] : void 0);
      if (void 0 !== n || g) {
        h[k] = void 0 !== n ? n : null;
      } else {
        return;
      }
    }
    return h;
  }
  return null === b ? null : Y(a, b, e, void 0 === f ? F() : f);
}

function Ua(a, b) {
  return q(q({}, a), {
    context: q(q({}, a.context), {
      meta: q(q({}, a.context.meta), {
        cacheOutcome: b
      })
    })
  });
}

function Va(a) {
  return q(q({}, a), {
    query: formatDocument(a.query)
  });
}

function Wa(a) {
  return "query" === a.operationName && "network-only" !== a.context.requestPolicy;
}

function Xa(a, b) {
  return q(q({}, a), {
    context: q(q({}, a.context), {
      requestPolicy: b
    })
  });
}

function $a(a) {
  return Wa(a);
}

function ab(a) {
  return Ua(a.operation, a.outcome);
}

function bb(a) {
  return "miss" === a.outcome;
}

function cb(a) {
  return "miss" !== a.outcome;
}

function db(a) {
  return !Wa(a);
}

function gb(a) {
  return "populate" !== r(a);
}

function hb(a, b) {
  "FragmentDefinition" === b.kind && a.add(b.name.value);
  return a;
}

function ib(a, b, c, d) {
  function e(a, b) {
    if (!(b = c[b.name])) {
      return a;
    }
    for (var e = 0, f = b.length; e < f; e++) {
      for (var l = b[e].fragment, n = r(l), C = jb(l), x = 0, v = C.length; x < v; x++) {
        var w = C[x];
        k.has(w) || (g[w] = d[w]);
      }
      h[n] = l;
      a.push({
        kind: Kind.FRAGMENT_SPREAD,
        name: fb(n)
      });
    }
    return a;
  }
  var f = new TypeInfo(a), g = F(), h = F(), k = new Set;
  return visit(b, visitWithTypeInfo(f, {
    Field: {
      enter: function(b) {
        if (b.directives) {
          var c = b.directives.filter(gb);
          if (c.length !== b.directives.length) {
            var d = ba(f.getType());
            isCompositeType(d) ? d = isAbstractType(d) ? a.getPossibleTypes(d) : [ d ] : ("production" !== process.env.NODE_ENV && B("Invalid type: The type ` + type + ` is used with @populate but does not exist.", 17), 
            d = []);
            d = d.reduce(e, []);
            var g = u(b);
            d = 0 !== g.length + d.length ? d.concat(g) : [ {
              kind: Kind.FIELD,
              name: fb("__typename")
            } ];
            return q(q({}, b), {
              directives: c,
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: d
              }
            });
          }
        }
      }
    },
    Document: {
      enter: function(a) {
        a.definitions.reduce(hb, k);
      },
      leave: function(a) {
        var c, b = [].concat(a.definitions);
        for (c in h) {
          b.push(h[c]);
        }
        for (var d in g) {
          b.push(g[d]);
        }
        return q(q({}, a), {
          definitions: b
        });
      }
    }
  }));
}

function fb(a) {
  return {
    kind: Kind.NAME,
    value: a
  };
}

function jb(a) {
  var b = [];
  visit(a, {
    FragmentSpread: function(a) {
      b.push(r(a));
    }
  });
  return b;
}

var Store = X;

var cacheExchange = function(a) {
  return function(b) {
    function c(a) {
      var b = a.operation, c = a.error, d = a.extensions, f = "query" === b.operationName, w = a.data, k = b.key, l = new Set;
      h(l, C.get(k));
      C.delete(k);
      var m = p.data;
      delete m.refLock[k];
      ma(m.records, k);
      ma(m.links, k);
      if (null != w) {
        var Q = xa(p, b, w).dependencies;
        if (f) {
          w = (k = Pa(p, b)).data;
          var n = k.dependencies;
        } else {
          w = Pa(p, b, w).data;
        }
      }
      h(l, Q);
      f && h(l, n);
      g(a.operation, l);
      f && void 0 !== n && e(a.operation, n);
      return {
        data: w,
        error: c,
        extensions: d,
        operation: b
      };
    }
    function d(a) {
      var b = Pa(p, a), c = b.data, d = b.dependencies;
      b = b.partial;
      null === c ? d = "miss" : (e(a, d), d = b && "cache-only" !== a.context.requestPolicy ? "partial" : "hit");
      return {
        outcome: d,
        operation: a,
        data: c
      };
    }
    function e(a, b) {
      b.forEach((function(b) {
        (v[b] || (v[b] = [])).push(a.key);
        x.has(a.key) || x.set(a.key, "network-only" === a.context.requestPolicy ? Xa(a, "cache-and-network") : a);
      }));
    }
    function f(a) {
      if ("mutation" === a.operationName && "network-only" !== a.context.requestPolicy) {
        var b = a.key, c = Da(p, a, b).dependencies;
        0 !== c.size && (C.set(b, c), h(b = new Set, c), g(a, b));
      }
    }
    function g(a, b) {
      b.forEach((function(b) {
        if (b !== a.key) {
          var c = x.get(b);
          void 0 !== c && (x.delete(b), m.reexecuteOperation(Xa(c, "cache-first")));
        }
      }));
    }
    function h(a, b) {
      void 0 !== b && b.forEach((function c(b) {
        var c = v[b];
        if (void 0 !== c) {
          v[b] = [];
          b = 0;
          for (var d = c.length; b < d; b++) {
            a.add(c[b]);
          }
        }
      }));
    }
    function l(a) {
      var b = a.operation, c = a.outcome, d = b.context.requestPolicy;
      a = {
        operation: Ua(b, c),
        data: a.data,
        error: a.error,
        extensions: a.extensions
      };
      if ("cache-and-network" === d || "cache-first" === d && "partial" === c) {
        a.stale = !0, m.reexecuteOperation(Xa(b, "network-only"));
      }
      return a;
    }
    var n = b.forward, m = b.client;
    a || (a = {});
    var p = new X(a.schema ? new Z(a.schema) : void 0, a.resolvers, a.updates, a.optimistic, a.keys);
    if (a.storage) {
      var Q = a.storage;
      var I = Q.read().then((function k(a) {
        var b = p.data, c = Q;
        K(b, 0);
        for (var d in a) {
          var e = d.indexOf("."), f = d.slice(2, e);
          e = d.slice(e + 1);
          switch (d.charCodeAt(0)) {
           case 108:
            va(f, e, a[d]);
            break;

           case 114:
            S(f, e, a[d]);
          }
        }
        L();
        b.storage = c;
      }));
    }
    var C = new Map, x = new Map, v = F();
    return function(a) {
      a = share(a);
      var b = I ? mergeMap(fromArray)(take(1)(buffer(fromPromise(I))(a))) : empty;
      a = share(tap(f)(map(Va)(concat([ b, a ]))));
      var e = share(map(d)(filter($a)(a)));
      b = map(ab)(filter(bb)(e));
      e = map(l)(filter(cb)(e));
      a = map(c)(n(merge([ filter(db)(a), b ])));
      return merge([ a, e ]);
    };
  };
};

var clearDataState = L;

var initDataState = K;

var populateExchange = function(a) {
  var b = a.schema;
  return function(a) {
    function c(a) {
      "teardown" === a.operationName && n.delete(a.key);
    }
    function e(a) {
      var b = a.key, c = a.query;
      if ("query" === a.operationName && (n.add(b), !l.has(b))) {
        l.add(b);
        a = function eb(a, b) {
          var c = [], d = [], e = new TypeInfo(a);
          visit(b, visitWithTypeInfo(e, {
            Field: function(a) {
              if (a.selectionSet) {
                var b = ba(e.getType());
                A(b && !isAbstractType(b), "production" !== process.env.NODE_ENV ? "Invalid TypeInfo state: Found no flat schema type when one was expected." : "", 18);
                b = b.toString();
                d.push({
                  kind: Kind.FRAGMENT_DEFINITION,
                  typeCondition: {
                    kind: Kind.NAMED_TYPE,
                    name: fb(b)
                  },
                  name: fb(b + "_PopulateFragment_"),
                  selectionSet: a.selectionSet
                });
              }
            },
            FragmentDefinition: function(a) {
              c.push(a);
            }
          }));
          return [ c, d ];
        }(k, c);
        c = a[0];
        a = a[1];
        for (var d = 0, e = c.length; d < e; d++) {
          var f = c[d];
          m[r(f)] = f;
        }
        c = 0;
        for (d = a.length; c < d; c++) {
          f = r((e = a[c]).typeCondition), f = p[f] || (p[f] = []), e.name.value += f.length, 
          f.push({
            key: b,
            fragment: e
          });
        }
      }
    }
    function f(a) {
      if ("mutation" !== a.operationName) {
        return a;
      }
      var c, b = F();
      for (c in p) {
        b[c] = p[c].filter(g);
      }
      return q(q({}, a), {
        query: ib(k, a.query, b, m)
      });
    }
    function g(a) {
      return n.has(a.key);
    }
    var h = a.forward, k = buildClientSchema(b), l = new Set, n = new Set, m = F(), p = F();
    return function(a) {
      return h(map(f)(tap(c)(tap(e)(a))));
    };
  };
};

var query = Pa;

var read = Ia;

var write = xa;

var writeFragment = Fa;

var writeOptimistic = Da;

export { Store, cacheExchange, clearDataState, initDataState, populateExchange, query, read, write, writeFragment, writeOptimistic };
//# sourceMappingURL=urql-exchange-graphcache.es.js.map
