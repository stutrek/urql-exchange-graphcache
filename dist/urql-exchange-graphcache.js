"use strict";

var mobx = require("mobx"), graphql = require("graphql"), core = require("urql/core"), wonka = require("wonka");

function _extends() {
  return (_extends = Object.assign || function(a) {
    for (var b = 1; b < arguments.length; b++) {
      var d, c = arguments[b];
      for (d in c) {
        Object.prototype.hasOwnProperty.call(c, d) && (a[d] = c[d]);
      }
    }
    return a;
  }).apply(this, arguments);
}

var getName = function(a) {
  return a.name.value;
}, getFragmentTypeName = function(a) {
  return a.typeCondition.name.value;
}, getFieldAlias = function(a) {
  return void 0 !== a.alias ? a.alias.value : getName(a);
}, getSelectionSet = function(a) {
  return void 0 !== a.selectionSet ? a.selectionSet.selections : [];
}, getTypeCondition = function(a) {
  return void 0 !== (a = a.typeCondition) ? getName(a) : null;
}, isFieldNode = function(a) {
  return a.kind === graphql.Kind.FIELD;
}, isInlineFragment = function(a) {
  return a.kind === graphql.Kind.INLINE_FRAGMENT;
}, unwrapType = function(a) {
  return graphql.isWrappingType(a) ? unwrapType(a.ofType) : a || null;
}, helpUrl = "\nhttps://github.com/FormidableLabs/urql-exchange-graphcache/blob/master/docs/help.md#", cache = new Set, currentDebugStack = [], pushDebugNode = function(a, b) {
  var c = "";
  b.kind === graphql.Kind.INLINE_FRAGMENT ? c = a ? 'Inline Fragment on "' + a + '"' : "Inline Fragment" : b.kind === graphql.Kind.OPERATION_DEFINITION ? c = (b.name ? '"' + b.name.value + '"' : "Unnamed") + " " + b.operation : b.kind === graphql.Kind.FRAGMENT_DEFINITION && (c = '"' + b.name.value + '" Fragment');
  c && currentDebugStack.push(c);
}, getDebugOutput = function() {
  return currentDebugStack.length ? "\n(Caused At: " + currentDebugStack.join(", ") + ")" : "";
};

function invariant(a, b, c) {
  if (!a) {
    throw a = b || "Minfied Error #" + c + "\n", "production" !== process.env.NODE_ENV && (a += getDebugOutput()), 
    (c = Error(a + helpUrl + c)).name = "Graphcache Error", c;
  }
}

function warn(a, b) {
  cache.has(a) || (console.warn(a + getDebugOutput() + helpUrl + b), cache.add(a));
}

var keyOfField = function(a, b) {
  return b ? a + "(" + core.stringifyVariables(b) + ")" : a;
}, fieldInfoOfKey = function(a) {
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
}, joinKeys = function(a, b) {
  return a + "." + b;
}, prefixKey = function(a, b) {
  return a + "|" + b;
}, defer = "production" === process.env.NODE_ENV && "undefined" != typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : function(a) {
  return setTimeout(a, 0);
}, makeDict = function() {
  return mobx.observable({});
}, currentData = null, currentDependencies = null, currentOptimisticKey = null, makeNodeMap = function() {
  return {
    optimistic: makeDict(),
    base: new Map,
    keys: []
  };
}, initDataState = function(a, b) {
  window.currentData = currentData = a;
  currentDependencies = new Set;
  currentOptimisticKey = b;
  "production" !== process.env.NODE_ENV && (currentDebugStack.length = 0);
}, clearDataState = function() {
  var c = currentData;
  !c.gcScheduled && 0 < c.gcBatch.size && (c.gcScheduled = !0, defer((function a() {
    gc(c);
  })));
  c.storage && !c.persistenceScheduled && (c.persistenceScheduled = !0, defer((function b() {
    c.storage.write(c.persistenceBatch);
    c.persistenceScheduled = !1;
    c.persistenceBatch = makeDict();
  })));
  currentOptimisticKey = currentDependencies = currentData = null;
  "production" !== process.env.NODE_ENV && (currentDebugStack.length = 0);
}, getCurrentDependencies = function() {
  invariant(null !== currentDependencies, "production" !== process.env.NODE_ENV ? "Invalid Cache call: The cache may only be accessed or mutated duringoperations like write or query, or as part of its resolvers, updaters, or optimistic configs." : "", 2);
  return currentDependencies;
}, setNode = function(a, b, c, d) {
  currentOptimisticKey ? (void 0 === a.optimistic[currentOptimisticKey] && (a.optimistic[currentOptimisticKey] = new Map, 
  a.keys.unshift(currentOptimisticKey)), a = a.optimistic[currentOptimisticKey]) : a = a.base;
  var e = a.get(b);
  void 0 === e && a.set(b, e = makeDict());
  void 0 !== d || currentOptimisticKey ? e[c] = d : delete e[c];
}, getNode = function(a, b, c) {
  for (var d = 0, e = a.keys.length; d < e; d++) {
    var f = a.optimistic[a.keys[d]].get(b);
    if (void 0 !== f && c in f) {
      return f[c];
    }
  }
  return void 0 !== (a = a.base.get(b)) ? a[c] : void 0;
}, clearOptimisticNodes = function(a, b) {
  var c = a.keys.indexOf(b);
  -1 < c && (delete a.optimistic[b], a.keys.splice(c, 1));
}, updateRCForEntity = function(a, b, c, d) {
  var e = void 0 !== b[c] ? b[c] : 0;
  b = b[c] = e + d | 0;
  void 0 !== a && (0 >= b ? a.add(c) : 0 >= e && 0 < b && a.delete(c));
}, updateRCForLink = function(a, b, c, d) {
  if ("string" == typeof c) {
    updateRCForEntity(a, b, c, d);
  } else if (Array.isArray(c)) {
    for (var e = 0, f = c.length; e < f; e++) {
      var g = c[e];
      g && updateRCForEntity(a, b, g, d);
    }
  }
}, extractNodeFields = function(a, b, c) {
  if (void 0 !== c) {
    for (var d in c) {
      b.has(d) || (a.push(fieldInfoOfKey(d)), b.add(d));
    }
  }
}, extractNodeMapFields = function(a, b, c, d) {
  extractNodeFields(a, b, d.base.get(c));
  for (var e = 0, f = d.keys.length; e < f; e++) {
    extractNodeFields(a, b, d.optimistic[d.keys[e]].get(c));
  }
}, gc = function(a) {
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
          c = prefixKey("r", joinKeys(b, e)), a.persistenceBatch[c] = void 0;
        }
      }
      if (void 0 !== (e = a.links.base.get(b))) {
        a.links.base.delete(b);
        for (var f in e) {
          a.storage && (c = prefixKey("l", joinKeys(b, f)), a.persistenceBatch[c] = void 0), 
          updateRCForLink(a.gcBatch, a.refCount, e[f], -1);
        }
      }
    } else {
      a.gcBatch.delete(b);
    }
  }));
}, updateDependencies = function(a, b) {
  "__typename" !== b && (a !== currentData.queryRootKey ? currentDependencies.add(a) : void 0 !== b && currentDependencies.add(joinKeys(a, b)));
}, readRecord = function(a, b) {
  updateDependencies(a, b);
  return getNode(currentData.records, a, b);
}, readLink = function(a, b) {
  updateDependencies(a, b);
  return getNode(currentData.links, a, b);
}, writeRecord = function(a, b, c) {
  updateDependencies(a, b);
  setNode(currentData.records, a, b, c);
  currentData.storage && !currentOptimisticKey && (a = prefixKey("r", joinKeys(a, b)), 
  currentData.persistenceBatch[a] = c);
}, writeLink = function(a, b, c) {
  var d = currentData;
  if (currentOptimisticKey) {
    var e = d.refLock[currentOptimisticKey] || (d.refLock[currentOptimisticKey] = makeDict());
    var f = d.links.optimistic[currentOptimisticKey];
  } else {
    d.storage && (e = prefixKey("l", joinKeys(a, b)), d.persistenceBatch[e] = c);
    e = d.refCount;
    f = d.links.base;
    var g = d.gcBatch;
  }
  f = void 0 !== (f = void 0 !== f ? f.get(a) : void 0) ? f[b] : null;
  updateDependencies(a, b);
  setNode(d.links, a, b, c);
  updateRCForLink(g, e, f, -1);
  updateRCForLink(g, e, c, 1);
}, hydrateData = function(a, b, c) {
  initDataState(a, 0);
  for (var d in c) {
    var e = d.indexOf("."), f = d.slice(2, e);
    e = d.slice(e + 1);
    switch (d.charCodeAt(0)) {
     case 108:
      writeLink(f, e, c[d]);
      break;

     case 114:
      writeRecord(f, e, c[d]);
    }
  }
  clearDataState();
  a.storage = b;
}, isFragmentHeuristicallyMatching = function(a, b, c, d) {
  if (!b) {
    return !1;
  }
  var e = getTypeCondition(a);
  if (b === e) {
    return !0;
  }
  "production" !== process.env.NODE_ENV && warn("Heuristic Fragment Matching: A fragment is trying to match against the `" + b + "` type, but the type condition is `" + e + "`. Since GraphQL allows for interfaces `" + e + "` may be aninterface.\nA schema needs to be defined for this match to be deterministic, otherwise the fragment will be matched heuristically!", 16);
  return !getSelectionSet(a).some((function(a) {
    if (!isFieldNode(a)) {
      return !1;
    }
    a = keyOfField(getName(a), getFieldArguments(a, d.variables));
    return !function(a, b) {
      return void 0 !== readRecord(a, b) || void 0 !== readLink(a, b);
    }(c, a);
  }));
}, SelectionIterator = function(a, b, c, d) {
  this.typename = a;
  this.entityKey = b;
  this.context = d;
  this.indexStack = [ 0 ];
  this.selectionStack = [ c ];
};

SelectionIterator.prototype.next = function() {
  for (;0 !== this.indexStack.length; ) {
    var a = this.indexStack[this.indexStack.length - 1]++, b = this.selectionStack[this.selectionStack.length - 1];
    if (a >= b.length) {
      this.indexStack.pop(), this.selectionStack.pop();
    } else if (shouldInclude(a = b[a], this.context.variables)) {
      if (isFieldNode(a)) {
        if ("__typename" !== getName(a)) {
          return a;
        }
      } else if (void 0 !== (a = isInlineFragment(a) ? a : this.context.fragments[getName(a)]) && ("production" !== process.env.NODE_ENV && pushDebugNode(this.typename, a), 
      void 0 !== this.context.schemaPredicates ? this.context.schemaPredicates.isInterfaceOfType(getTypeCondition(a), this.typename) : isFragmentHeuristicallyMatching(a, this.typename, this.entityKey, this.context))) {
        this.indexStack.push(0), this.selectionStack.push(getSelectionSet(a));
      }
    }
  }
};

var ensureData = function(a) {
  return void 0 === a ? null : a;
}, write = function(a, b, c) {
  initDataState(a.data, 0);
  a = startWrite(a, b, c);
  clearDataState();
  return a;
}, startWrite = function(a, b, c) {
  var d = getMainOperation(b.query), e = {
    dependencies: getCurrentDependencies()
  }, f = getSelectionSet(d), g = a.getRootKey(d.operation);
  a = {
    parentTypeName: g,
    parentKey: g,
    parentFieldKey: "",
    fieldName: "",
    variables: normalizeVariables(d, b.variables),
    fragments: getFragments(b.query),
    result: e,
    store: a,
    schemaPredicates: a.schemaPredicates
  };
  "production" !== process.env.NODE_ENV && pushDebugNode(g, d);
  g === a.store.getRootKey("query") ? writeSelection(a, g, f, c) : writeRoot(a, g, f, c);
  return e;
}, writeOptimistic = function(a, b, c) {
  initDataState(a.data, c);
  var d = getMainOperation(b.query);
  c = {
    dependencies: getCurrentDependencies()
  };
  var e = a.getRootKey("mutation"), f = a.getRootKey(d.operation);
  invariant(f === e, "production" !== process.env.NODE_ENV ? "writeOptimistic(...) was called with an operation that is not a mutation.\nThis case is unsupported and should never occur." : "", 10);
  "production" !== process.env.NODE_ENV && pushDebugNode(f, d);
  a = {
    parentTypeName: e,
    parentKey: e,
    parentFieldKey: "",
    fieldName: "",
    variables: normalizeVariables(d, b.variables),
    fragments: getFragments(b.query),
    result: c,
    store: a,
    schemaPredicates: a.schemaPredicates,
    optimistic: !0
  };
  b = makeDict();
  d = new SelectionIterator(f, f, getSelectionSet(d), a);
  for (var g; void 0 !== (g = d.next()); ) {
    if (void 0 !== g.selectionSet) {
      var h = getName(g), k = a.store.optimisticMutations[h];
      if (void 0 !== k) {
        a.fieldName = h;
        k = k((f = getFieldArguments(g, a.variables)) || makeDict(), a.store, a);
        var m = ensureData(k);
        writeRootField(a, m, getSelectionSet(g));
        b[h] = k;
        void 0 !== (g = a.store.updates[e][h]) && g(b, f || makeDict(), a.store, a);
      }
    }
  }
  clearDataState();
  return c;
}, writeFragment = function(a, b, c, d) {
  b = getFragments(b);
  var e = Object.keys(b);
  if (void 0 === (e = b[e[0]])) {
    return "production" !== process.env.NODE_ENV ? warn("writeFragment(...) was called with an empty fragment.\nYou have to call it with at least one fragment in your GraphQL document.", 11) : void 0;
  }
  var f = getFragmentTypeName(e);
  c = _extends({
    __typename: f
  }, c);
  var g = a.keyOfEntity(c);
  if (!g) {
    return "production" !== process.env.NODE_ENV ? warn("Can't generate a key for writeFragment(...) data.\nYou have to pass an `id` or `_id` field or create a custom `keys` config for `" + f + "`.", 12) : void 0;
  }
  "production" !== process.env.NODE_ENV && pushDebugNode(f, e);
  a = {
    parentTypeName: f,
    parentKey: g,
    parentFieldKey: "",
    fieldName: "",
    variables: d || {},
    fragments: b,
    result: {
      dependencies: getCurrentDependencies()
    },
    store: a,
    schemaPredicates: a.schemaPredicates
  };
  writeSelection(a, g, getSelectionSet(e), c);
}, writeSelection = function(a, b, c, d) {
  var e = b === a.store.getRootKey("query") ? b : d.__typename;
  if ("string" == typeof e) {
    writeRecord(b, "__typename", e);
    c = new SelectionIterator(e, b, c, a);
    for (var f; void 0 !== (f = c.next()); ) {
      var g = getName(f), h = getFieldArguments(f, a.variables);
      h = keyOfField(g, h);
      var k = d[getFieldAlias(f)], m = joinKeys(b, h);
      if ("production" !== process.env.NODE_ENV) {
        if (void 0 === k) {
          g = a.optimistic ? "\nYour optimistic result may be missing a field!" : "";
          f = void 0 === f.selectionSet ? "scalar (number, boolean, etc)" : "selection set";
          "production" !== process.env.NODE_ENV && warn("Invalid undefined: The field at `" + h + "` is `undefined`, but the GraphQL query expects a " + f + " for this field." + g, 13);
          continue;
        } else {
          a.schemaPredicates && e && a.schemaPredicates.isFieldAvailableOnType(e, g);
        }
      }
      void 0 === f.selectionSet ? writeRecord(b, h, k) : (g = ensureData(k), f = writeField(a, m, getSelectionSet(f), g), 
      writeLink(b, h, f));
    }
  }
}, writeField = function(a, b, c, d) {
  if (Array.isArray(d)) {
    for (var e = Array(d.length), f = 0, g = d.length; f < g; f++) {
      var h = d[f], k = joinKeys(b, "" + f);
      h = writeField(a, k, c, h);
      e[f] = h;
    }
    return e;
  }
  if (null === d) {
    return null;
  }
  f = null !== (e = a.store.keyOfEntity(d)) ? e : b;
  g = d.__typename;
  void 0 !== a.store.keys[d.__typename] || null !== e || "string" != typeof g || g.endsWith("Connection") || g.endsWith("Edge") || "PageInfo" === g || "production" !== process.env.NODE_ENV && warn("Invalid key: The GraphQL query at the field at `" + b + "` has a selection set, but no key could be generated for the data at this field.\nYou have to request `id` or `_id` fields for all selection sets or create a custom `keys` config for `" + g + "`.\nEntities without keys will be embedded directly on the parent entity. If this is intentional, create a `keys` config for `" + g + "` that always returns null.", 15);
  writeSelection(a, f, c, d);
  return f;
}, writeRoot = function(a, b, c, d) {
  var e = b === a.store.getRootKey("mutation") || b === a.store.getRootKey("subscription");
  c = new SelectionIterator(b, b, c, a);
  for (var f; void 0 !== (f = c.next()); ) {
    var g = getName(f), h = getFieldArguments(f, a.variables), k = joinKeys(b, keyOfField(g, h));
    if (void 0 !== f.selectionSet) {
      var m = ensureData(d[getFieldAlias(f)]);
      writeRootField(a, m, getSelectionSet(f));
    }
    e && (a.parentTypeName = b, a.parentKey = b, a.parentFieldKey = k, a.fieldName = g, 
    void 0 !== (f = a.store.updates[b][g]) && f(d, h || makeDict(), a.store, a));
  }
}, writeRootField = function(a, b, c) {
  if (Array.isArray(b)) {
    for (var d = Array(b.length), e = 0, f = b.length; e < f; e++) {
      d[e] = writeRootField(a, b[e], c);
    }
    return d;
  }
  null !== b && (null !== (d = a.store.keyOfEntity(b)) ? writeSelection(a, d, c, b) : writeRoot(a, b.__typename, c, b));
}, invalidateSelection = function(a, b, c) {
  if ("Query" !== b) {
    var d = readRecord(b, "__typename");
    if ("string" != typeof d) {
      return;
    }
    writeRecord(b, "__typename", void 0);
  } else {
    d = b;
  }
  c = new SelectionIterator(d, b, c, a);
  for (var e; void 0 !== (e = c.next()); ) {
    var f = getName(e), g = keyOfField(f, getFieldArguments(e, a.variables));
    "production" !== process.env.NODE_ENV && a.schemaPredicates && d && a.schemaPredicates.isFieldAvailableOnType(d, f);
    if (void 0 === e.selectionSet) {
      writeRecord(b, g, void 0);
    } else if (e = getSelectionSet(e), f = readLink(b, g), writeLink(b, g, void 0), 
    writeRecord(b, g, void 0), Array.isArray(f)) {
      g = 0;
      for (var h = f.length; g < h; g++) {
        var k = f[g];
        null !== k && invalidateSelection(a, k, e);
      }
    } else {
      f && invalidateSelection(a, f, e);
    }
  }
}, Store = function(a, b, c, d, e) {
  var g, f = this;
  this.gcScheduled = !1;
  this.gc = function() {
    gc(f.data);
    f.gcScheduled = !1;
  };
  this.keyOfField = keyOfField;
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
  this.data = function(a) {
    return {
      persistenceScheduled: !1,
      persistenceBatch: makeDict(),
      gcScheduled: !1,
      queryRootKey: a,
      gcBatch: new Set,
      refCount: makeDict(),
      refLock: makeDict(),
      links: makeNodeMap(),
      records: makeNodeMap(),
      storage: null
    };
  }(this.getRootKey("query"));
};

Store.prototype.getRootKey = function(a) {
  return this.rootFields[a];
};

Store.prototype.keyOfEntity = function(a) {
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

Store.prototype.resolveFieldByKey = function(a, b) {
  if (null === (a = null !== a && "string" != typeof a ? this.keyOfEntity(a) : a)) {
    return null;
  }
  var c = readRecord(a, b);
  return void 0 !== c ? c : (b = readLink(a, b)) ? b : null;
};

Store.prototype.resolve = function(a, b, c) {
  return this.resolveFieldByKey(a, keyOfField(b, c));
};

Store.prototype.invalidateQuery = function(a, b) {
  !function(a, b) {
    var c = getMainOperation(b.query);
    a = {
      variables: normalizeVariables(c, b.variables),
      fragments: getFragments(b.query),
      store: a,
      schemaPredicates: a.schemaPredicates
    };
    invalidateSelection(a, a.store.getRootKey("query"), getSelectionSet(c));
  }(this, core.createRequest(a, b));
};

Store.prototype.inspectFields = function(a) {
  return null !== (a = null !== a && "string" != typeof a ? this.keyOfEntity(a) : a) ? function(a) {
    var b = currentData.links, c = currentData.records, d = [], e = new Set;
    updateDependencies(a);
    extractNodeMapFields(d, e, a, b);
    extractNodeMapFields(d, e, a, c);
    return d;
  }(a) : [];
};

Store.prototype.updateQuery = function(a, b) {
  a = core.createRequest(a.query, a.variables);
  null !== (b = b(this.readQuery(a))) && startWrite(this, a, b);
};

Store.prototype.readQuery = function(a) {
  return read(this, core.createRequest(a.query, a.variables)).data;
};

Store.prototype.readFragment = function(a, b, c) {
  return readFragment(this, a, b, c);
};

Store.prototype.writeFragment = function(a, b, c) {
  writeFragment(this, a, b, c);
};

var getFieldArguments = function(a, b) {
  if (void 0 === a.arguments || 0 === a.arguments.length) {
    return null;
  }
  for (var c = makeDict(), d = 0, e = 0, f = a.arguments.length; e < f; e++) {
    var g = a.arguments[e], h = graphql.valueFromASTUntyped(g.value, b);
    null != h && (c[getName(g)] = h, d++);
  }
  return 0 < d ? c : null;
}, normalizeVariables = function(a, b) {
  if (void 0 === a.variableDefinitions) {
    return {};
  }
  var c = b || {};
  return a.variableDefinitions.reduce((function(a, b) {
    var d = getName(b.variable), e = c[d];
    if (void 0 === e) {
      if (void 0 !== b.defaultValue) {
        e = graphql.valueFromASTUntyped(b.defaultValue, c);
      } else {
        return a;
      }
    }
    a[d] = e;
    return a;
  }), makeDict());
}, SchemaPredicates = function(a) {
  this.schema = graphql.buildClientSchema(a);
};

SchemaPredicates.prototype.isFieldNullable = function(a, b) {
  return void 0 === (a = getField(this.schema, a, b)) ? !1 : graphql.isNullableType(a.type);
};

SchemaPredicates.prototype.isListNullable = function(a, b) {
  if (void 0 === (a = getField(this.schema, a, b))) {
    return !1;
  }
  a = graphql.isNonNullType(a.type) ? a.type.ofType : a.type;
  return graphql.isListType(a) && graphql.isNullableType(a.ofType);
};

SchemaPredicates.prototype.isFieldAvailableOnType = function(a, b) {
  return !!getField(this.schema, a, b);
};

SchemaPredicates.prototype.isInterfaceOfType = function(a, b) {
  if (!b || !a) {
    return !1;
  }
  if (b === a) {
    return !0;
  }
  var c = this.schema.getType(a), d = this.schema.getType(b);
  if (c instanceof graphql.GraphQLObjectType) {
    return c === d;
  }
  !function expectAbstractType(a, b) {
    invariant(a instanceof graphql.GraphQLInterfaceType || a instanceof graphql.GraphQLUnionType, "production" !== process.env.NODE_ENV ? "Invalid Abstract type: The type `" + b + "` is not an Interface or Union type in the defined schema, but a fragment in the GraphQL document is using it as a type condition." : "", 5);
  }(c, a);
  expectObjectType(d, b);
  return this.schema.isPossibleType(c, d);
};

var getField = function(a, b, c) {
  expectObjectType(a = a.getType(b), b);
  if (void 0 === (a = a.getFields()[c])) {
    "production" !== process.env.NODE_ENV && warn("Invalid field: The field `" + c + "` does not exist on `" + b + "`, but the GraphQL document expects it to exist.\nTraversal will continue, however this may lead to undefined behavior!", 4);
  } else {
    return a;
  }
};

function expectObjectType(a, b) {
  invariant(a instanceof graphql.GraphQLObjectType, "production" !== process.env.NODE_ENV ? "Invalid Object type: The type `" + b + "` is not an object in the defined schema, but the GraphQL document is traversing it." : "", 3);
}

var isFragmentNode = function(a) {
  return a.kind === graphql.Kind.FRAGMENT_DEFINITION;
};

function _ref(a) {
  return a.kind === graphql.Kind.OPERATION_DEFINITION;
}

var getMainOperation = function(a) {
  invariant(!!(a = a.definitions.find(_ref)), "production" !== process.env.NODE_ENV ? "Invalid GraphQL document: All GraphQL documents must contain an OperationDefinitionnode for a query, subscription, or mutation." : "", 1);
  return a;
};

function _ref2(a, b) {
  a[getName(b)] = b;
  return a;
}

var getFragments = function(a) {
  return a.definitions.filter(isFragmentNode).reduce(_ref2, {});
}, shouldInclude = function(a, b) {
  if (void 0 === (a = a.directives)) {
    return !0;
  }
  for (var c = 0, d = a.length; c < d; c++) {
    var e = a[c], f = getName(e), g = "include" === f;
    if ((g || "skip" === f) && (e = e.arguments ? e.arguments[0] : null) && "if" === getName(e) && ("boolean" == typeof (e = graphql.valueFromASTUntyped(e.value, b)) || null === e)) {
      return g ? !!e : !e;
    }
  }
  return !0;
}, query = function(a, b, c) {
  initDataState(a.data, 0);
  return read(a, b, c);
}, read = function(a, b, c) {
  var d = getMainOperation(b.query), e = a.getRootKey(d.operation), f = getSelectionSet(d);
  a = {
    parentTypeName: e,
    parentKey: e,
    parentFieldKey: "",
    fieldName: "",
    variables: normalizeVariables(d, b.variables),
    fragments: getFragments(b.query),
    partial: !1,
    store: a,
    schemaPredicates: a.schemaPredicates
  };
  "production" !== process.env.NODE_ENV && pushDebugNode(e, d);
  c = c || makeDict();
  c = e !== a.store.getRootKey("query") ? readRoot(a, e, f, c) : readSelection(a, e, f, c);
  return {
    dependencies: getCurrentDependencies(),
    partial: void 0 === c ? !1 : a.partial,
    data: void 0 === c ? null : c
  };
}, readRoot = function(a, b, c, d) {
  if ("string" != typeof d.__typename) {
    return d;
  }
  b = new SelectionIterator(b, b, c, a);
  (c = makeDict()).__typename = d.__typename;
  for (var e; void 0 !== (e = b.next()); ) {
    var f = getFieldAlias(e), g = d[f];
    void 0 !== e.selectionSet && null !== g ? (g = ensureData(g), c[f] = readRootField(a, getSelectionSet(e), g)) : c[f] = g;
  }
  return c;
}, readRootField = function(a, b, c) {
  if (Array.isArray(c)) {
    for (var d = Array(c.length), e = 0, f = c.length; e < f; e++) {
      d[e] = readRootField(a, b, c[e]);
    }
    return d;
  }
  if (null === c) {
    return null;
  }
  return null !== (d = a.store.keyOfEntity(c)) ? void 0 === (a = readSelection(a, d, b, makeDict())) ? null : a : readRoot(a, c.__typename, b, c);
}, readFragment = function(a, b, c, d) {
  b = getFragments(b);
  var e = Object.keys(b);
  if (void 0 === (e = b[e[0]])) {
    return "production" !== process.env.NODE_ENV && warn("readFragment(...) was called with an empty fragment.\nYou have to call it with at least one fragment in your GraphQL document.", 6), 
    null;
  }
  var f = getFragmentTypeName(e);
  "string" == typeof c || c.__typename || (c.__typename = f);
  if (!(c = "string" != typeof c ? a.keyOfEntity(_extends({
    __typename: f
  }, c)) : c)) {
    return "production" !== process.env.NODE_ENV && warn("Can't generate a key for readFragment(...).\nYou have to pass an `id` or `_id` field or create a custom `keys` config for `" + f + "`.", 7), 
    null;
  }
  "production" !== process.env.NODE_ENV && pushDebugNode(f, e);
  return readSelection({
    parentTypeName: f,
    parentKey: c,
    parentFieldKey: "",
    fieldName: "",
    variables: d || {},
    fragments: b,
    partial: !1,
    store: a,
    schemaPredicates: a.schemaPredicates
  }, c, getSelectionSet(e), makeDict()) || null;
}, readSelection = mobx.action((function(a, b, c, d) {
  var e = a.store, f = a.schemaPredicates, g = b === e.getRootKey("query"), h = g ? b : readRecord(b, "__typename");
  if ("string" == typeof h) {
    d.__typename = h;
    c = new SelectionIterator(h, b, c, a);
    for (var k, m = !1, n = !1, l = function() {
      var q = getName(k), l = getFieldArguments(k, a.variables), p = getFieldAlias(k), u = keyOfField(q, l), w = readRecord(b, u), y = function(a, b) {
        updateDependencies(a, b);
        return function(a, b, c) {
          for (var d = 0, e = a.keys.length; d < e; d++) {
            var f = a.optimistic[a.keys[d]].get(b);
            if (void 0 !== f && c in f) {
              return f;
            }
          }
          return void 0 !== (a = a.base.get(b)) ? a : void 0;
        }(currentData.records, a, b);
      }(b, u), C = joinKeys(b, u), A = !1;
      "production" !== process.env.NODE_ENV && f && h && f.isFieldAvailableOnType(h, q);
      var t = void 0, B = e.resolvers[h];
      if (void 0 !== B && "function" == typeof B[q]) {
        if (a.parentTypeName = h, a.parentKey = b, a.parentFieldKey = C, a.fieldName = q, 
        void 0 !== w && (d[p] = w), t = B[q](d, l || makeDict(), e, a), void 0 !== k.selectionSet && (t = resolveResolverResult(a, h, q, C, getSelectionSet(k), d[p] || makeDict(), t)), 
        void 0 !== f && null === t && !f.isFieldNullable(h, q)) {
          return {
            v: void 0
          };
        }
      } else if (void 0 === k.selectionSet) {
        t = w, A = !0, void 0 === d[p] && Object.defineProperty(d, p, {
          get: function c() {
            return null != y ? y[p] : void 0;
          }
        });
      } else if (void 0 !== (l = readLink(b, u))) {
        if (t = resolveLink(a, l, h, q, getSelectionSet(k), d[p]), void 0 === d[p]) {
          A = !0;
          var E = k, D = h;
          Object.defineProperty(d, p, {
            get: function g() {
              var c = readLink(b, u);
              if (c) {
                return null != (c = resolveLink(a, c, D, q, getSelectionSet(E), void 0)) ? c : void 0;
              }
            }
          });
        }
      } else {
        "object" == typeof w && null !== w && (t = w);
      }
      if (void 0 === t && void 0 !== f && f.isFieldNullable(h, q)) {
        n = !0, d[p] = null;
      } else {
        if (void 0 === t) {
          return {
            v: void 0
          };
        }
        m = !0;
        !1 === A && (d[p] = t);
      }
    }; void 0 !== (k = c.next()); ) {
      var p = l();
      if (p) {
        return p.v;
      }
    }
    n && (a.partial = !0);
    return g && n && !m ? void 0 : d;
  }
})), resolveResolverResult = function(a, b, c, d, e, f, g) {
  if (Array.isArray(g)) {
    var h = a.schemaPredicates;
    h = void 0 === h || h.isListNullable(b, c);
    for (var k = Array(g.length), m = 0, n = g.length; m < n; m++) {
      var l = resolveResolverResult(a, b, c, joinKeys(d, "" + m), e, void 0 !== f ? f[m] : void 0, g[m]);
      if (void 0 !== l || h) {
        k[m] = void 0 !== l ? l : null;
      } else {
        return;
      }
    }
    return k;
  }
  if (null == g) {
    return g;
  }
  if (isDataOrKey(g)) {
    return b = void 0 === f ? makeDict() : f, "string" == typeof g ? readSelection(a, g, e, b) : function(a, b, c, d, e) {
      var f = a.schemaPredicates;
      b = a.store.keyOfEntity(e) || b;
      var g = e.__typename, h = readRecord(b, "__typename") || g;
      if ("string" != typeof h || g && h !== g) {
        "production" !== process.env.NODE_ENV && warn("Invalid resolver data: The resolver at `" + b + "` returned an invalid typename that could not be reconciled with the cache.", 8);
      } else {
        d.__typename = h;
        c = new SelectionIterator(h, b, c, a);
        for (var k = !1, m = !1; void 0 !== (g = c.next()); ) {
          var n = getName(g), l = getFieldAlias(g), p = keyOfField(n, getFieldArguments(g, a.variables)), x = joinKeys(b, p), v = readRecord(b, p), q = e[n];
          "production" !== process.env.NODE_ENV && f && h && f.isFieldAvailableOnType(h, n);
          var r = void 0;
          void 0 !== q && void 0 === g.selectionSet ? r = q : void 0 === g.selectionSet ? r = v : void 0 !== q ? r = resolveResolverResult(a, h, n, x, getSelectionSet(g), d[l], q) : void 0 !== (p = readLink(b, p)) ? r = resolveLink(a, p, h, n, getSelectionSet(g), d[l]) : "object" == typeof v && null !== v && (r = v);
          if (void 0 === r && void 0 !== f && f.isFieldNullable(h, n)) {
            m = !0, d[l] = null;
          } else {
            if (void 0 === r) {
              return;
            }
            k = !0;
            d[l] = r;
          }
        }
        m && (a.partial = !0);
        return k ? d : void 0;
      }
    }(a, d, e, b, g);
  }
  "production" !== process.env.NODE_ENV && warn("Invalid resolver value: The field at `" + d + "` is a scalar (number, boolean, etc), but the GraphQL query expects a selection set for this field.", 9);
}, resolveLink = function(a, b, c, d, e, f) {
  if (Array.isArray(b)) {
    var g = a.schemaPredicates;
    g = void 0 !== g && g.isListNullable(c, d);
    for (var h = Array(b.length), k = 0, m = b.length; k < m; k++) {
      var n = resolveLink(a, b[k], c, d, e, void 0 !== f ? f[k] : void 0);
      if (void 0 !== n || g) {
        h[k] = void 0 !== n ? n : null;
      } else {
        return;
      }
    }
    return h;
  }
  return null === b ? null : readSelection(a, b, e, void 0 === f ? makeDict() : f);
}, isDataOrKey = function(a) {
  return "string" == typeof a || "object" == typeof a && "string" == typeof a.__typename;
}, addCacheOutcome = function(a, b) {
  return _extends(_extends({}, a), {
    context: _extends(_extends({}, a.context), {
      meta: _extends(_extends({}, a.context.meta), {
        cacheOutcome: b
      })
    })
  });
}, addTypeNames = function(a) {
  return _extends(_extends({}, a), {
    query: core.formatDocument(a.query)
  });
}, getRequestPolicy = function(a) {
  return a.context.requestPolicy;
}, isQueryOperation = function(a) {
  return "query" === a.operationName;
}, isCacheableQuery = function(a) {
  return isQueryOperation(a) && "network-only" !== getRequestPolicy(a);
}, toRequestPolicy = function(a, b) {
  return _extends(_extends({}, a), {
    context: _extends(_extends({}, a.context), {
      requestPolicy: b
    })
  });
};

function _ref3(a) {
  return isCacheableQuery(a);
}

function _ref4(a) {
  return addCacheOutcome(a.operation, a.outcome);
}

function _ref5(a) {
  return "miss" === a.outcome;
}

function _ref7(a) {
  return "miss" !== a.outcome;
}

function _ref8(a) {
  return !isCacheableQuery(a);
}

var extractSelectionsFromQuery = function(a, b) {
  var c = [], d = [], e = new graphql.TypeInfo(a);
  graphql.visit(b, graphql.visitWithTypeInfo(e, {
    Field: function(a) {
      if (a.selectionSet) {
        var b = getTypeName(e);
        d.push({
          kind: graphql.Kind.FRAGMENT_DEFINITION,
          typeCondition: {
            kind: graphql.Kind.NAMED_TYPE,
            name: nameNode(b)
          },
          name: nameNode(b + "_PopulateFragment_"),
          selectionSet: a.selectionSet
        });
      }
    },
    FragmentDefinition: function(a) {
      c.push(a);
    }
  }));
  return [ c, d ];
};

function _ref2$1(a) {
  return "populate" !== getName(a);
}

function _ref4$1(a, b) {
  "FragmentDefinition" === b.kind && a.add(b.name.value);
  return a;
}

var addFragmentsToQuery = function(a, b, c, d) {
  function e(a, b) {
    if (!(b = c[b.name])) {
      return a;
    }
    for (var e = 0, f = b.length; e < f; e++) {
      for (var m = b[e].fragment, n = getName(m), q = getUsedFragments(m), r = 0, z = q.length; r < z; r++) {
        var u = q[r];
        k.has(u) || (g[u] = d[u]);
      }
      h[n] = m;
      a.push({
        kind: graphql.Kind.FRAGMENT_SPREAD,
        name: nameNode(n)
      });
    }
    return a;
  }
  var f = new graphql.TypeInfo(a), g = makeDict(), h = makeDict(), k = new Set;
  return graphql.visit(b, graphql.visitWithTypeInfo(f, {
    Field: {
      enter: function(b) {
        if (b.directives) {
          var c = b.directives.filter(_ref2$1);
          if (c.length !== b.directives.length) {
            var d = getTypes(a, f).reduce(e, []), g = getSelectionSet(b);
            d = 0 !== g.length + d.length ? d.concat(g) : [ {
              kind: graphql.Kind.FIELD,
              name: nameNode("__typename")
            } ];
            return _extends(_extends({}, b), {
              directives: c,
              selectionSet: {
                kind: graphql.Kind.SELECTION_SET,
                selections: d
              }
            });
          }
        }
      }
    },
    Document: {
      enter: function(a) {
        a.definitions.reduce(_ref4$1, k);
      },
      leave: function(a) {
        var c, b = [].concat(a.definitions);
        for (c in h) {
          b.push(h[c]);
        }
        for (var d in g) {
          b.push(g[d]);
        }
        return _extends(_extends({}, a), {
          definitions: b
        });
      }
    }
  }));
}, nameNode = function(a) {
  return {
    kind: graphql.Kind.NAME,
    value: a
  };
}, getTypes = function(a, b) {
  b = unwrapType(b.getType());
  return graphql.isCompositeType(b) ? graphql.isAbstractType(b) ? a.getPossibleTypes(b) : [ b ] : ("production" !== process.env.NODE_ENV && warn("Invalid type: The type ` + type + ` is used with @populate but does not exist.", 17), 
  []);
}, getTypeName = function(a) {
  invariant((a = unwrapType(a.getType())) && !graphql.isAbstractType(a), "production" !== process.env.NODE_ENV ? "Invalid TypeInfo state: Found no flat schema type when one was expected." : "", 18);
  return a.toString();
}, getUsedFragments = function(a) {
  var b = [];
  graphql.visit(a, {
    FragmentSpread: function(a) {
      b.push(getName(a));
    }
  });
  return b;
};

exports.Store = Store;

exports.cacheExchange = function(a) {
  return function(b) {
    function d(a) {
      var b = a.operation, c = a.outcome, d = getRequestPolicy(b);
      a = {
        operation: addCacheOutcome(b, c),
        data: a.data,
        error: a.error,
        extensions: a.extensions
      };
      if ("cache-and-network" === d || "cache-first" === d && "partial" === c) {
        a.stale = !0, f.reexecuteOperation(toRequestPolicy(b, "network-only"));
      }
      return a;
    }
    var e = b.forward, f = b.client;
    a || (a = {});
    var g = new Store(a.schema ? new SchemaPredicates(a.schema) : void 0, a.resolvers, a.updates, a.optimistic, a.keys);
    if (a.storage) {
      var h = a.storage;
      var k = h.read().then((function c(a) {
        hydrateData(g.data, h, a);
      }));
    }
    var m = new Map, n = new Map, l = makeDict(), p = function(a, b) {
      void 0 !== b && b.forEach((function c(b) {
        var c = l[b];
        if (void 0 !== c) {
          l[b] = [];
          b = 0;
          for (var d = c.length; b < d; b++) {
            a.add(c[b]);
          }
        }
      }));
    }, x = function(a, b) {
      b.forEach((function(b) {
        if (b !== a.key) {
          var c = n.get(b);
          void 0 !== c && (n.delete(b), f.reexecuteOperation(toRequestPolicy(c, "cache-first")));
        }
      }));
    }, v = function(a) {
      if (function(a) {
        return function(a) {
          return "mutation" === a.operationName;
        }(a) && "network-only" !== getRequestPolicy(a);
      }(a)) {
        var b = a.key, c = writeOptimistic(g, a, b).dependencies;
        0 !== c.size && (m.set(b, c), b = new Set, p(b, c), x(a, b));
      }
    }, q = function(a, b) {
      b.forEach((function(b) {
        (l[b] || (l[b] = [])).push(a.key);
        n.has(a.key) || n.set(a.key, "network-only" === getRequestPolicy(a) ? toRequestPolicy(a, "cache-and-network") : a);
      }));
    }, r = function(a) {
      var b = query(g, a), c = b.data, d = b.dependencies;
      b = b.partial;
      null === c ? d = "miss" : (q(a, d), d = b && "cache-only" !== getRequestPolicy(a) ? "partial" : "hit");
      return {
        outcome: d,
        operation: a,
        data: c
      };
    }, z = function(a) {
      var b = a.operation, c = a.error, d = a.extensions, e = isQueryOperation(b), f = a.data, h = b.key, k = new Set;
      p(k, m.get(h));
      m.delete(h);
      !function(a, b) {
        delete a.refLock[b];
        clearOptimisticNodes(a.records, b);
        clearOptimisticNodes(a.links, b);
      }(g.data, h);
      if (null != f) {
        var n = write(g, b, f).dependencies;
        if (e) {
          f = (h = query(g, b)).data;
          var l = h.dependencies;
        } else {
          f = query(g, b, f).data;
        }
      }
      p(k, n);
      e && p(k, l);
      x(a.operation, k);
      e && void 0 !== l && q(a.operation, l);
      return {
        data: f,
        error: c,
        extensions: d,
        operation: b
      };
    };
    return function(a) {
      a = wonka.share(a);
      var b = k ? wonka.mergeMap(wonka.fromArray)(wonka.take(1)(wonka.buffer(wonka.fromPromise(k))(a))) : wonka.empty;
      a = wonka.share(wonka.tap(v)(wonka.map(addTypeNames)(wonka.concat([ b, a ]))));
      var c = wonka.share(wonka.map(r)(wonka.filter(_ref3)(a)));
      b = wonka.map(_ref4)(wonka.filter(_ref5)(c));
      c = wonka.map(d)(wonka.filter(_ref7)(c));
      a = wonka.map(z)(e(wonka.merge([ wonka.filter(_ref8)(a), b ])));
      return wonka.merge([ a, c ]);
    };
  };
};

exports.clearDataState = clearDataState;

exports.initDataState = initDataState;

exports.populateExchange = function(a) {
  var b = a.schema;
  return function(a) {
    function c(a) {
      return h.has(a.key);
    }
    var e = a.forward, f = graphql.buildClientSchema(b), g = new Set, h = new Set, k = makeDict(), m = makeDict(), n = function(a) {
      if ("mutation" !== a.operationName) {
        return a;
      }
      var d, b = makeDict();
      for (d in m) {
        b[d] = m[d].filter(c);
      }
      return _extends(_extends({}, a), {
        query: addFragmentsToQuery(f, a.query, b, k)
      });
    }, l = function(a) {
      var b = a.key, c = a.query;
      if ("query" === a.operationName && (h.add(b), !g.has(b))) {
        g.add(b);
        c = (a = extractSelectionsFromQuery(f, c))[0];
        a = a[1];
        for (var d = 0, e = c.length; d < e; d++) {
          var l = c[d];
          k[getName(l)] = l;
        }
        c = 0;
        for (d = a.length; c < d; c++) {
          l = getName((e = a[c]).typeCondition), l = m[l] || (m[l] = []), e.name.value += l.length, 
          l.push({
            key: b,
            fragment: e
          });
        }
      }
    }, p = function(a) {
      "teardown" === a.operationName && h.delete(a.key);
    };
    return function(a) {
      return e(wonka.map(n)(wonka.tap(p)(wonka.tap(l)(a))));
    };
  };
};

exports.query = query;

exports.read = read;

exports.write = write;

exports.writeFragment = writeFragment;

exports.writeOptimistic = writeOptimistic;
//# sourceMappingURL=urql-exchange-graphcache.js.map
