'use strict';

var mobx = require('mobx');
var graphql = require('graphql');
var core = require('urql/core');
var wonka = require('wonka');

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

/** Returns the name of a given node */

var getName = function (node) {
  return node.name.value;
};
var getFragmentTypeName = function (node) {
  return node.typeCondition.name.value;
};
/** Returns either the field's name or the field's alias */

var getFieldAlias = function (node) {
  return node.alias !== undefined ? node.alias.value : getName(node);
};
/** Returns the SelectionSet for a given inline or defined fragment node */

var getSelectionSet = function (node) {
  return node.selectionSet !== undefined ? node.selectionSet.selections : [];
};
var getTypeCondition = function (ref) {
  var typeCondition = ref.typeCondition;
  return typeCondition !== undefined ? getName(typeCondition) : null;
};
var isFieldNode = function (node) {
  return node.kind === graphql.Kind.FIELD;
};
var isInlineFragment = function (node) {
  return node.kind === graphql.Kind.INLINE_FRAGMENT;
};
var unwrapType = function (type) {
  if (graphql.isWrappingType(type)) {
    return unwrapType(type.ofType);
  }

  return type || null;
};

// These are guards that are used throughout the codebase to warn or error on
var helpUrl = '\nhttps://github.com/FormidableLabs/urql-exchange-graphcache/blob/master/docs/help.md#';
var cache = new Set();
var currentDebugStack = [];
var pushDebugNode = function (typename, node) {
  var identifier = '';

  if (node.kind === graphql.Kind.INLINE_FRAGMENT) {
    identifier = typename ? "Inline Fragment on \"" + typename + "\"" : 'Inline Fragment';
  } else if (node.kind === graphql.Kind.OPERATION_DEFINITION) {
    var name = node.name ? "\"" + node.name.value + "\"" : 'Unnamed';
    identifier = name + " " + node.operation;
  } else if (node.kind === graphql.Kind.FRAGMENT_DEFINITION) {
    identifier = "\"" + node.name.value + "\" Fragment";
  }

  if (identifier) {
    currentDebugStack.push(identifier);
  }
};

var getDebugOutput = function () {
  return currentDebugStack.length ? '\n(Caused At: ' + currentDebugStack.join(', ') + ')' : '';
};

function invariant(condition, message, code) {
  if (!condition) {
    var errorMessage = message || 'Minfied Error #' + code + '\n';

    if (process.env.NODE_ENV !== 'production') {
      errorMessage += getDebugOutput();
    }

    var error = new Error(errorMessage + helpUrl + code);
    error.name = 'Graphcache Error';
    throw error;
  }
}
function warn(message, code) {
  if (!cache.has(message)) {
    console.warn(message + getDebugOutput() + helpUrl + code);
    cache.add(message);
  }
}

var keyOfField = function (fieldName, args) {
  return args ? fieldName + "(" + core.stringifyVariables(args) + ")" : fieldName;
};
var fieldInfoOfKey = function (fieldKey) {
  var parenIndex = fieldKey.indexOf('(');

  if (parenIndex > -1) {
    return {
      fieldKey: fieldKey,
      fieldName: fieldKey.slice(0, parenIndex),
      arguments: JSON.parse(fieldKey.slice(parenIndex + 1, -1))
    };
  } else {
    return {
      fieldKey: fieldKey,
      fieldName: fieldKey,
      arguments: null
    };
  }
};
var joinKeys = function (parentKey, key) {
  return parentKey + "." + key;
};
/** Prefix key with its owner type Link / Record */

var prefixKey = function (owner, key) {
  return owner + "|" + key;
};

var defer = process.env.NODE_ENV === 'production' && typeof Promise !== 'undefined' ? Promise.prototype.then.bind(Promise.resolve()) : function (fn) {
  return setTimeout(fn, 0);
};

var makeDict = function () {
  return mobx.observable({});
};
var currentData = null;
var currentDependencies = null;
var currentOptimisticKey = null;

var makeNodeMap = function () {
  return {
    optimistic: makeDict(),
    base: new Map(),
    keys: []
  };
};
/** Before reading or writing the global state needs to be initialised */


var initDataState = function (data, optimisticKey) {
  //@ts-ignore
  window.currentData = currentData = data;
  currentDependencies = new Set();
  currentOptimisticKey = optimisticKey;

  if (process.env.NODE_ENV !== 'production') {
    currentDebugStack.length = 0;
  }
};
/** Reset the data state after read/write is complete */

var clearDataState = function () {
  var data = currentData;

  function _ref() {
    gc(data);
  }

  if (!data.gcScheduled && data.gcBatch.size > 0) {
    data.gcScheduled = true;
    defer(_ref);
  }

  function _ref2() {
    data.storage.write(data.persistenceBatch);
    data.persistenceScheduled = false;
    data.persistenceBatch = makeDict();
  }

  if (data.storage && !data.persistenceScheduled) {
    data.persistenceScheduled = true;
    defer(_ref2);
  }

  currentData = null;
  currentDependencies = null;
  currentOptimisticKey = null;

  if (process.env.NODE_ENV !== 'production') {
    currentDebugStack.length = 0;
  }
};
/** As we're writing, we keep around all the records and links we've read or have written to */

var getCurrentDependencies = function () {
  invariant(currentDependencies !== null, process.env.NODE_ENV !== "production" ? 'Invalid Cache call: The cache may only be accessed or mutated during' + 'operations like write or query, or as part of its resolvers, updaters, ' + 'or optimistic configs.' : "", 2);
  return currentDependencies;
};
var make = function (queryRootKey) {
  return {
    persistenceScheduled: false,
    persistenceBatch: makeDict(),
    gcScheduled: false,
    queryRootKey: queryRootKey,
    gcBatch: new Set(),
    refCount: makeDict(),
    refLock: makeDict(),
    links: makeNodeMap(),
    records: makeNodeMap(),
    storage: null
  };
};
/** Adds a node value to a NodeMap (taking optimistic values into account */

var setNode = function (map, entityKey, fieldKey, value) {
  // Optimistic values are written to a map in the optimistic dict
  // All other values are written to the base map
  var keymap;

  if (currentOptimisticKey) {
    // If the optimistic map doesn't exist yet, it' created, and
    // the optimistic key is stored (in order of priority)
    if (map.optimistic[currentOptimisticKey] === undefined) {
      map.optimistic[currentOptimisticKey] = new Map();
      map.keys.unshift(currentOptimisticKey);
    }

    keymap = map.optimistic[currentOptimisticKey];
  } else {
    keymap = map.base;
  } // On the map itself we get or create the entity as a dict


  var entity = keymap.get(entityKey);

  if (entity === undefined) {
    keymap.set(entityKey, entity = makeDict());
  } // If we're setting undefined we delete the node's entry
  // On optimistic layers we actually set undefined so it can
  // override the base value


  if (value === undefined && !currentOptimisticKey) {
    delete entity[fieldKey];
  } else {
    entity[fieldKey] = value;
  }
};
/** Gets a node value from a NodeMap (taking optimistic values into account */


var getNode = function (map, entityKey, fieldKey) {
  // This first iterates over optimistic layers (in order)
  for (var i = 0, l = map.keys.length; i < l; i++) {
    var optimistic = map.optimistic[map.keys[i]];
    var node$1 = optimistic.get(entityKey); // If the node and node value exists it is returned, including undefined

    if (node$1 !== undefined && fieldKey in node$1) {
      return node$1[fieldKey];
    }
  } // Otherwise we read the non-optimistic base value


  var node = map.base.get(entityKey);
  return node !== undefined ? node[fieldKey] : undefined;
};
/** Gets a node value from a NodeMap (taking optimistic values into account */


var getNodeParent = function (map, entityKey, fieldKey) {
  // This first iterates over optimistic layers (in order)
  for (var i = 0, l = map.keys.length; i < l; i++) {
    var optimistic = map.optimistic[map.keys[i]];
    var node$1 = optimistic.get(entityKey); // If the node and node value exists it is returned, including undefined

    if (node$1 !== undefined && fieldKey in node$1) {
      return node$1;
    }
  } // Otherwise we read the non-optimistic base value


  var node = map.base.get(entityKey);
  return node !== undefined ? node : undefined;
};
/** Clears an optimistic layers from a NodeMap */


var clearOptimisticNodes = function (map, optimisticKey) {
  // Check whether the optimistic layer exists on the NodeMap
  var index = map.keys.indexOf(optimisticKey);

  if (index > -1) {
    // Then delete it and splice out the optimisticKey
    delete map.optimistic[optimisticKey];
    map.keys.splice(index, 1);
  }
};
/** Adjusts the reference count of an entity on a refCount dict by "by" and updates the gcBatch */


var updateRCForEntity = function (gcBatch, refCount, entityKey, by) {
  // Retrieve the reference count
  var count = refCount[entityKey] !== undefined ? refCount[entityKey] : 0; // Adjust it by the "by" value

  var newCount = refCount[entityKey] = count + by | 0; // Add it to the garbage collection batch if it needs to be deleted or remove it
  // from the batch if it needs to be kept

  if (gcBatch !== undefined) {
    if (newCount <= 0) {
      gcBatch.add(entityKey);
    } else if (count <= 0 && newCount > 0) {
      gcBatch.delete(entityKey);
    }
  }
};
/** Adjusts the reference counts of all entities of a link on a refCount dict by "by" and updates the gcBatch */


var updateRCForLink = function (gcBatch, refCount, link, by) {
  if (typeof link === 'string') {
    updateRCForEntity(gcBatch, refCount, link, by);
  } else if (Array.isArray(link)) {
    for (var i = 0, l = link.length; i < l; i++) {
      var entityKey = link[i];

      if (entityKey) {
        updateRCForEntity(gcBatch, refCount, entityKey, by);
      }
    }
  }
};
/** Writes all parsed FieldInfo objects of a given node dict to a given array if it hasn't been seen */


var extractNodeFields = function (fieldInfos, seenFieldKeys, node) {
  if (node !== undefined) {
    for (var fieldKey in node) {
      if (!seenFieldKeys.has(fieldKey)) {
        // If the node hasn't been seen the serialized fieldKey is turnt back into
        // a rich FieldInfo object that also contains the field's name and arguments
        fieldInfos.push(fieldInfoOfKey(fieldKey));
        seenFieldKeys.add(fieldKey);
      }
    }
  }
};
/** Writes all parsed FieldInfo objects of all nodes in a NodeMap to a given array */


var extractNodeMapFields = function (fieldInfos, seenFieldKeys, entityKey, map) {
  // Extracts FieldInfo for the entity in the base map
  extractNodeFields(fieldInfos, seenFieldKeys, map.base.get(entityKey)); // Then extracts FieldInfo for the entity from the optimistic maps

  for (var i = 0, l = map.keys.length; i < l; i++) {
    var optimistic = map.optimistic[map.keys[i]];
    extractNodeFields(fieldInfos, seenFieldKeys, optimistic.get(entityKey));
  }
};
/** Garbage collects all entities that have been marked as having no references */


var gc = function (data) {
  // Reset gcScheduled flag
  data.gcScheduled = false; // Iterate over all entities that have been marked for deletion
  // Entities have been marked for deletion in `updateRCForEntity` if
  // their reference count dropped to 0

  data.gcBatch.forEach(function (entityKey) {
    // Check first whether the reference count is still 0
    var rc = data.refCount[entityKey] || 0;

    if (rc <= 0) {
      // Each optimistic layer may also still contain some references to marked entities
      for (var optimisticKey in data.refLock) {
        var refCount = data.refLock[optimisticKey];
        var locks = refCount[entityKey] || 0; // If the optimistic layer has any references to the entity, don't GC it,
        // otherwise delete the reference count from the optimistic layer

        if (locks > 0) {
          return;
        }

        delete refCount[entityKey];
      } // All conditions are met: The entity can be deleted
      // Delete the reference count, and delete the entity from the GC batch


      delete data.refCount[entityKey];
      data.gcBatch.delete(entityKey); // Delete the record and for each of its fields, delete them on the persistence
      // layer if one is present
      // No optimistic data needs to be deleted, as the entity is not being referenced by
      // anything and optimistic layers will eventually be deleted anyway

      var recordsNode = data.records.base.get(entityKey);

      if (recordsNode !== undefined) {
        data.records.base.delete(entityKey);

        if (data.storage) {
          for (var fieldKey in recordsNode) {
            var key = prefixKey('r', joinKeys(entityKey, fieldKey));
            data.persistenceBatch[key] = undefined;
          }
        }
      } // Delete all the entity's links, but also update the reference count
      // for those links (which can lead to an unrolled recursive GC of the children)


      var linkNode = data.links.base.get(entityKey);

      if (linkNode !== undefined) {
        data.links.base.delete(entityKey);

        for (var fieldKey$1 in linkNode) {
          // Delete all links from the persistence layer if one is present
          if (data.storage) {
            var key$1 = prefixKey('l', joinKeys(entityKey, fieldKey$1));
            data.persistenceBatch[key$1] = undefined;
          }

          updateRCForLink(data.gcBatch, data.refCount, linkNode[fieldKey$1], -1);
        }
      }
    } else {
      data.gcBatch.delete(entityKey);
    }
  });
};

var updateDependencies = function (entityKey, fieldKey) {
  if (fieldKey !== '__typename') {
    if (entityKey !== currentData.queryRootKey) {
      currentDependencies.add(entityKey);
    } else if (fieldKey !== undefined) {
      currentDependencies.add(joinKeys(entityKey, fieldKey));
    }
  }
};
/** Reads an entity's field (a "record") from data */


var readRecord = function (entityKey, fieldKey) {
  updateDependencies(entityKey, fieldKey);
  return getNode(currentData.records, entityKey, fieldKey);
};
var readParent = function (entityKey, fieldKey) {
  updateDependencies(entityKey, fieldKey);
  return getNodeParent(currentData.records, entityKey, fieldKey);
};
/** Reads an entity's link from data */

var readLink = function (entityKey, fieldKey) {
  updateDependencies(entityKey, fieldKey);
  return getNode(currentData.links, entityKey, fieldKey);
};
/** Writes an entity's field (a "record") to data */

var writeRecord = mobx.action(function (entityKey, fieldKey, value) {
  updateDependencies(entityKey, fieldKey);
  setNode(currentData.records, entityKey, fieldKey, value);

  if (currentData.storage && !currentOptimisticKey) {
    var key = prefixKey('r', joinKeys(entityKey, fieldKey));
    currentData.persistenceBatch[key] = value;
  }
});
var hasField = function (entityKey, fieldKey) {
  return readRecord(entityKey, fieldKey) !== undefined || readLink(entityKey, fieldKey) !== undefined;
};
/** Writes an entity's link to data */

var writeLink = function (entityKey, fieldKey, link) {
  var data = currentData; // Retrieve the reference counting dict or the optimistic reference locking dict

  var refCount; // Retrive the link NodeMap from either an optimistic or the base layer

  var links; // Set the GC batch if we're not optimistically updating

  var gcBatch;

  if (currentOptimisticKey) {
    // The refLock counters are also reference counters, but they prevent
    // garbage collection instead of being used to trigger it
    refCount = data.refLock[currentOptimisticKey] || (data.refLock[currentOptimisticKey] = makeDict());
    links = data.links.optimistic[currentOptimisticKey];
  } else {
    if (data.storage) {
      var key = prefixKey('l', joinKeys(entityKey, fieldKey));
      data.persistenceBatch[key] = link;
    }

    refCount = data.refCount;
    links = data.links.base;
    gcBatch = data.gcBatch;
  } // Retrieve the previous link for this field


  var prevLinkNode = links !== undefined ? links.get(entityKey) : undefined;
  var prevLink = prevLinkNode !== undefined ? prevLinkNode[fieldKey] : null; // Update dependencies

  updateDependencies(entityKey, fieldKey); // Update the link

  setNode(data.links, entityKey, fieldKey, link); // First decrease the reference count for the previous link

  updateRCForLink(gcBatch, refCount, prevLink, -1); // Then increase the reference count for the new link

  updateRCForLink(gcBatch, refCount, link, 1);
};
/** Removes an optimistic layer of links and records */

var clearOptimistic = function (data, optimisticKey) {
  // We also delete the optimistic reference locks
  delete data.refLock[optimisticKey];
  clearOptimisticNodes(data.records, optimisticKey);
  clearOptimisticNodes(data.links, optimisticKey);
};
/** Return an array of FieldInfo (info on all the fields and their arguments) for a given entity */

var inspectFields = function (entityKey) {
  var links = currentData.links;
  var records = currentData.records;
  var fieldInfos = [];
  var seenFieldKeys = new Set(); // Update dependencies

  updateDependencies(entityKey); // Extract FieldInfos to the fieldInfos array for links and records
  // This also deduplicates by keeping track of fieldKeys in the seenFieldKeys Set

  extractNodeMapFields(fieldInfos, seenFieldKeys, entityKey, links);
  extractNodeMapFields(fieldInfos, seenFieldKeys, entityKey, records);
  return fieldInfos;
};
var hydrateData = function (data, storage, entries) {
  initDataState(data, 0);

  for (var key in entries) {
    var dotIndex = key.indexOf('.');
    var entityKey = key.slice(2, dotIndex);
    var fieldKey = key.slice(dotIndex + 1);

    switch (key.charCodeAt(0)) {
      case 108:
        writeLink(entityKey, fieldKey, entries[key]);
        break;

      case 114:
        writeRecord(entityKey, fieldKey, entries[key]);
        break;
    }
  }

  clearDataState();
  data.storage = storage;
};

var isFragmentHeuristicallyMatching = function (node, typename, entityKey, ctx) {
  if (!typename) {
    return false;
  }

  var typeCondition = getTypeCondition(node);

  if (typename === typeCondition) {
    return true;
  }

  process.env.NODE_ENV !== 'production' ? warn('Heuristic Fragment Matching: A fragment is trying to match against the `' + typename + '` type, ' + 'but the type condition is `' + typeCondition + '`. Since GraphQL allows for interfaces `' + typeCondition + '` may be an' + 'interface.\nA schema needs to be defined for this match to be deterministic, ' + 'otherwise the fragment will be matched heuristically!', 16) : void 0;
  return !getSelectionSet(node).some(function (node) {
    if (!isFieldNode(node)) {
      return false;
    }

    var fieldKey = keyOfField(getName(node), getFieldArguments(node, ctx.variables));
    return !hasField(entityKey, fieldKey);
  });
};

var SelectionIterator = function SelectionIterator(typename, entityKey, select, ctx) {
  this.typename = typename;
  this.entityKey = entityKey;
  this.context = ctx;
  this.indexStack = [0];
  this.selectionStack = [select];
};

SelectionIterator.prototype.next = function next() {
  while (this.indexStack.length !== 0) {
    var index = this.indexStack[this.indexStack.length - 1]++;
    var select = this.selectionStack[this.selectionStack.length - 1];

    if (index >= select.length) {
      this.indexStack.pop();
      this.selectionStack.pop();
      continue;
    } else {
      var node = select[index];

      if (!shouldInclude(node, this.context.variables)) {
        continue;
      } else if (!isFieldNode(node)) {
        // A fragment is either referred to by FragmentSpread or inline
        var fragmentNode = !isInlineFragment(node) ? this.context.fragments[getName(node)] : node;

        if (fragmentNode !== undefined) {
          if (process.env.NODE_ENV !== 'production') {
            pushDebugNode(this.typename, fragmentNode);
          }

          var isMatching = this.context.schemaPredicates !== undefined ? this.context.schemaPredicates.isInterfaceOfType(getTypeCondition(fragmentNode), this.typename) : isFragmentHeuristicallyMatching(fragmentNode, this.typename, this.entityKey, this.context);

          if (isMatching) {
            this.indexStack.push(0);
            this.selectionStack.push(getSelectionSet(fragmentNode));
          }
        }

        continue;
      } else if (getName(node) === '__typename') {
        continue;
      } else {
        return node;
      }
    }
  }

  return undefined;
};

var ensureData = function (x) {
  return x === undefined ? null : x;
};

/** Writes a request given its response to the store */

var write = mobx.action(function (store, request, data) {
  initDataState(store.data, 0);
  var result = startWrite(store, request, data);
  clearDataState();
  return result;
});
var startWrite = function (store, request, data) {
  var operation = getMainOperation(request.query);
  var result = {
    dependencies: getCurrentDependencies()
  };
  var select = getSelectionSet(operation);
  var operationName = store.getRootKey(operation.operation);
  var ctx = {
    parentTypeName: operationName,
    parentKey: operationName,
    parentFieldKey: '',
    fieldName: '',
    variables: normalizeVariables(operation, request.variables),
    fragments: getFragments(request.query),
    result: result,
    store: store,
    schemaPredicates: store.schemaPredicates
  };

  if (process.env.NODE_ENV !== 'production') {
    pushDebugNode(operationName, operation);
  }

  if (operationName === ctx.store.getRootKey('query')) {
    writeSelection(ctx, operationName, select, data);
  } else {
    writeRoot(ctx, operationName, select, data);
  }

  return result;
};
var writeOptimistic = function (store, request, optimisticKey) {
  initDataState(store.data, optimisticKey);
  var operation = getMainOperation(request.query);
  var result = {
    dependencies: getCurrentDependencies()
  };
  var mutationRootKey = store.getRootKey('mutation');
  var operationName = store.getRootKey(operation.operation);
  invariant(operationName === mutationRootKey, process.env.NODE_ENV !== "production" ? 'writeOptimistic(...) was called with an operation that is not a mutation.\n' + 'This case is unsupported and should never occur.' : "", 10);

  if (process.env.NODE_ENV !== 'production') {
    pushDebugNode(operationName, operation);
  }

  var ctx = {
    parentTypeName: mutationRootKey,
    parentKey: mutationRootKey,
    parentFieldKey: '',
    fieldName: '',
    variables: normalizeVariables(operation, request.variables),
    fragments: getFragments(request.query),
    result: result,
    store: store,
    schemaPredicates: store.schemaPredicates,
    optimistic: true
  };
  var data = makeDict();
  var iter = new SelectionIterator(operationName, operationName, getSelectionSet(operation), ctx);
  var node;

  while ((node = iter.next()) !== undefined) {
    if (node.selectionSet !== undefined) {
      var fieldName = getName(node);
      var resolver = ctx.store.optimisticMutations[fieldName];

      if (resolver !== undefined) {
        // We have to update the context to reflect up-to-date ResolveInfo
        ctx.fieldName = fieldName;
        var fieldArgs = getFieldArguments(node, ctx.variables);
        var resolverValue = resolver(fieldArgs || makeDict(), ctx.store, ctx);
        var resolverData = ensureData(resolverValue);
        writeRootField(ctx, resolverData, getSelectionSet(node));
        data[fieldName] = resolverValue;
        var updater = ctx.store.updates[mutationRootKey][fieldName];

        if (updater !== undefined) {
          updater(data, fieldArgs || makeDict(), ctx.store, ctx);
        }
      }
    }
  }

  clearDataState();
  return result;
};
var writeFragment = function (store, query, data, variables) {
  var fragments = getFragments(query);
  var names = Object.keys(fragments);
  var fragment = fragments[names[0]];

  if (fragment === undefined) {
    return process.env.NODE_ENV !== 'production' ? warn('writeFragment(...) was called with an empty fragment.\n' + 'You have to call it with at least one fragment in your GraphQL document.', 11) : void 0;
  }

  var typename = getFragmentTypeName(fragment);

  var writeData = _extends({
    __typename: typename
  }, data);

  var entityKey = store.keyOfEntity(writeData);

  if (!entityKey) {
    return process.env.NODE_ENV !== 'production' ? warn("Can't generate a key for writeFragment(...) data.\n" + 'You have to pass an `id` or `_id` field or create a custom `keys` config for `' + typename + '`.', 12) : void 0;
  }

  if (process.env.NODE_ENV !== 'production') {
    pushDebugNode(typename, fragment);
  }

  var ctx = {
    parentTypeName: typename,
    parentKey: entityKey,
    parentFieldKey: '',
    fieldName: '',
    variables: variables || {},
    fragments: fragments,
    result: {
      dependencies: getCurrentDependencies()
    },
    store: store,
    schemaPredicates: store.schemaPredicates
  };
  writeSelection(ctx, entityKey, getSelectionSet(fragment), writeData);
};

var writeSelection = function (ctx, entityKey, select, data) {
  var isQuery = entityKey === ctx.store.getRootKey('query');
  var typename = isQuery ? entityKey : data.__typename;

  if (typeof typename !== 'string') {
    return;
  }

  writeRecord(entityKey, '__typename', typename);
  var iter = new SelectionIterator(typename, entityKey, select, ctx);
  var node;

  while ((node = iter.next()) !== undefined) {
    var fieldName = getName(node);
    var fieldArgs = getFieldArguments(node, ctx.variables);
    var fieldKey = keyOfField(fieldName, fieldArgs);
    var fieldValue = data[getFieldAlias(node)];
    var key = joinKeys(entityKey, fieldKey);

    if (process.env.NODE_ENV !== 'production') {
      if (fieldValue === undefined) {
        var advice = ctx.optimistic ? '\nYour optimistic result may be missing a field!' : '';
        var expected = node.selectionSet === undefined ? 'scalar (number, boolean, etc)' : 'selection set';
        process.env.NODE_ENV !== 'production' ? warn('Invalid undefined: The field at `' + fieldKey + '` is `undefined`, but the GraphQL query expects a ' + expected + ' for this field.' + advice, 13) : void 0;
        continue; // Skip this field
      } else if (ctx.schemaPredicates && typename) {
        ctx.schemaPredicates.isFieldAvailableOnType(typename, fieldName);
      }
    }

    if (node.selectionSet === undefined) {
      // This is a leaf node, so we're setting the field's value directly
      writeRecord(entityKey, fieldKey, fieldValue);
    } else {
      // Process the field and write links for the child entities that have been written
      var fieldData = ensureData(fieldValue);
      var link = writeField(ctx, key, getSelectionSet(node), fieldData);
      writeLink(entityKey, fieldKey, link);
    }
  }
};

var writeField = function (ctx, parentFieldKey, select, data) {
  if (Array.isArray(data)) {
    var newData = new Array(data.length);

    for (var i = 0, l = data.length; i < l; i++) {
      var item = data[i]; // Append the current index to the parentFieldKey fallback

      var indexKey = joinKeys(parentFieldKey, "" + i); // Recursively write array data

      var links = writeField(ctx, indexKey, select, item); // Link cannot be expressed as a recursive type

      newData[i] = links;
    }

    return newData;
  } else if (data === null) {
    return null;
  }

  var entityKey = ctx.store.keyOfEntity(data);
  var key = entityKey !== null ? entityKey : parentFieldKey;
  var typename = data.__typename;

  if (ctx.store.keys[data.__typename] === undefined && entityKey === null && typeof typename === 'string' && !typename.endsWith('Connection') && !typename.endsWith('Edge') && typename !== 'PageInfo') {
    process.env.NODE_ENV !== 'production' ? warn('Invalid key: The GraphQL query at the field at `' + parentFieldKey + '` has a selection set, ' + 'but no key could be generated for the data at this field.\n' + 'You have to request `id` or `_id` fields for all selection sets or create ' + 'a custom `keys` config for `' + typename + '`.\n' + 'Entities without keys will be embedded directly on the parent entity. ' + 'If this is intentional, create a `keys` config for `' + typename + '` that always returns null.', 15) : void 0;
  }

  writeSelection(ctx, key, select, data);
  return key;
}; // This is like writeSelection but assumes no parent entity exists


var writeRoot = function (ctx, typename, select, data) {
  var isRootField = typename === ctx.store.getRootKey('mutation') || typename === ctx.store.getRootKey('subscription');
  var iter = new SelectionIterator(typename, typename, select, ctx);
  var node;

  while ((node = iter.next()) !== undefined) {
    var fieldName = getName(node);
    var fieldArgs = getFieldArguments(node, ctx.variables);
    var fieldKey = joinKeys(typename, keyOfField(fieldName, fieldArgs));

    if (node.selectionSet !== undefined) {
      var fieldValue = ensureData(data[getFieldAlias(node)]);
      writeRootField(ctx, fieldValue, getSelectionSet(node));
    }

    if (isRootField) {
      // We have to update the context to reflect up-to-date ResolveInfo
      ctx.parentTypeName = typename;
      ctx.parentKey = typename;
      ctx.parentFieldKey = fieldKey;
      ctx.fieldName = fieldName; // We run side-effect updates after the default, normalized updates
      // so that the data is already available in-store if necessary

      var updater = ctx.store.updates[typename][fieldName];

      if (updater !== undefined) {
        updater(data, fieldArgs || makeDict(), ctx.store, ctx);
      }
    }
  }
}; // This is like writeField but doesn't fall back to a generated key


var writeRootField = function (ctx, data, select) {
  if (Array.isArray(data)) {
    var newData = new Array(data.length);

    for (var i = 0, l = data.length; i < l; i++) {
      newData[i] = writeRootField(ctx, data[i], select);
    }

    return newData;
  } else if (data === null) {
    return;
  } // Write entity to key that falls back to the given parentFieldKey


  var entityKey = ctx.store.keyOfEntity(data);

  if (entityKey !== null) {
    writeSelection(ctx, entityKey, select, data);
  } else {
    var typename = data.__typename;
    writeRoot(ctx, typename, select, data);
  }
};

var invalidate = function (store, request) {
  var operation = getMainOperation(request.query);
  var ctx = {
    variables: normalizeVariables(operation, request.variables),
    fragments: getFragments(request.query),
    store: store,
    schemaPredicates: store.schemaPredicates
  };
  invalidateSelection(ctx, ctx.store.getRootKey('query'), getSelectionSet(operation));
};
var invalidateSelection = function (ctx, entityKey, select) {
  var isQuery = entityKey === 'Query';
  var typename;

  if (!isQuery) {
    typename = readRecord(entityKey, '__typename');

    if (typeof typename !== 'string') {
      return;
    } else {
      writeRecord(entityKey, '__typename', undefined);
    }
  } else {
    typename = entityKey;
  }

  var iter = new SelectionIterator(typename, entityKey, select, ctx);
  var node;

  while ((node = iter.next()) !== undefined) {
    var fieldName = getName(node);
    var fieldKey = keyOfField(fieldName, getFieldArguments(node, ctx.variables));

    if (process.env.NODE_ENV !== 'production' && ctx.schemaPredicates && typename) {
      ctx.schemaPredicates.isFieldAvailableOnType(typename, fieldName);
    }

    if (node.selectionSet === undefined) {
      writeRecord(entityKey, fieldKey, undefined);
    } else {
      var fieldSelect = getSelectionSet(node);
      var link = readLink(entityKey, fieldKey);
      writeLink(entityKey, fieldKey, undefined);
      writeRecord(entityKey, fieldKey, undefined);

      if (Array.isArray(link)) {
        for (var i = 0, l = link.length; i < l; i++) {
          var childLink = link[i];

          if (childLink !== null) {
            invalidateSelection(ctx, childLink, fieldSelect);
          }
        }
      } else if (link) {
        invalidateSelection(ctx, link, fieldSelect);
      }
    }
  }
};

var Store = function Store(schemaPredicates, resolvers, updates, optimisticMutations, keys) {
  var this$1 = this;
  var obj;
  this.gcScheduled = false;

  this.gc = function () {
    gc(this$1.data);
    this$1.gcScheduled = false;
  };

  this.keyOfField = keyOfField;
  this.resolvers = resolvers || {};
  this.optimisticMutations = optimisticMutations || {};
  this.keys = keys || {};
  this.schemaPredicates = schemaPredicates;
  this.updates = {
    Mutation: updates && updates.Mutation || {},
    Subscription: updates && updates.Subscription || {}
  };

  if (schemaPredicates) {
    var schema = schemaPredicates.schema;
    var queryType = schema.getQueryType();
    var mutationType = schema.getMutationType();
    var subscriptionType = schema.getSubscriptionType();
    var queryName = queryType ? queryType.name : 'Query';
    var mutationName = mutationType ? mutationType.name : 'Mutation';
    var subscriptionName = subscriptionType ? subscriptionType.name : 'Subscription';
    this.rootFields = {
      query: queryName,
      mutation: mutationName,
      subscription: subscriptionName
    };
    this.rootNames = (obj = {}, obj[queryName] = 'query', obj[mutationName] = 'mutation', obj[subscriptionName] = 'subscription', obj);
  } else {
    this.rootFields = {
      query: 'Query',
      mutation: 'Mutation',
      subscription: 'Subscription'
    };
    this.rootNames = {
      Query: 'query',
      Mutation: 'mutation',
      Subscription: 'subscription'
    };
  }

  this.data = make(this.getRootKey('query'));
};

Store.prototype.getRootKey = function getRootKey(name) {
  return this.rootFields[name];
};

Store.prototype.keyOfEntity = function keyOfEntity(data) {
  var typename = data.__typename;
  var id = data.id;
  var _id = data._id;

  if (!typename) {
    return null;
  } else if (this.rootNames[typename] !== undefined) {
    return typename;
  }

  var key;

  if (this.keys[typename]) {
    key = this.keys[typename](data);
  } else if (id !== undefined && id !== null) {
    key = "" + id;
  } else if (_id !== undefined && _id !== null) {
    key = "" + _id;
  }

  return key ? typename + ":" + key : null;
};

Store.prototype.resolveFieldByKey = function resolveFieldByKey(entity, fieldKey) {
  var entityKey = entity !== null && typeof entity !== 'string' ? this.keyOfEntity(entity) : entity;

  if (entityKey === null) {
    return null;
  }

  var fieldValue = readRecord(entityKey, fieldKey);

  if (fieldValue !== undefined) {
    return fieldValue;
  }

  var link = readLink(entityKey, fieldKey);
  return link ? link : null;
};

Store.prototype.resolve = function resolve(entity, field, args) {
  return this.resolveFieldByKey(entity, keyOfField(field, args));
};

Store.prototype.invalidateQuery = function invalidateQuery(query, variables) {
  invalidate(this, core.createRequest(query, variables));
};

Store.prototype.inspectFields = function inspectFields$1(entity) {
  var entityKey = entity !== null && typeof entity !== 'string' ? this.keyOfEntity(entity) : entity;
  return entityKey !== null ? inspectFields(entityKey) : [];
};

Store.prototype.updateQuery = function updateQuery(input, updater) {
  var request = core.createRequest(input.query, input.variables);
  var output = updater(this.readQuery(request));

  if (output !== null) {
    startWrite(this, request, output);
  }
};

Store.prototype.readQuery = function readQuery(input) {
  return read(this, core.createRequest(input.query, input.variables)).data;
};

Store.prototype.readFragment = function readFragment$1(dataFragment, entity, variables) {
  return readFragment(this, dataFragment, entity, variables);
};

Store.prototype.writeFragment = function writeFragment$1(dataFragment, data, variables) {
  writeFragment(this, dataFragment, data, variables);
};

/** Evaluates a fields arguments taking vars into account */

var getFieldArguments = function (node, vars) {
  if (node.arguments === undefined || node.arguments.length === 0) {
    return null;
  }

  var args = makeDict();
  var argsSize = 0;

  for (var i = 0, l = node.arguments.length; i < l; i++) {
    var arg = node.arguments[i];
    var value = graphql.valueFromASTUntyped(arg.value, vars);

    if (value !== undefined && value !== null) {
      args[getName(arg)] = value;
      argsSize++;
    }
  }

  return argsSize > 0 ? args : null;
};
/** Returns a normalized form of variables with defaulted values */

var normalizeVariables = function (node, input) {
  if (node.variableDefinitions === undefined) {
    return {};
  }

  var args = input || {};
  return node.variableDefinitions.reduce(function (vars, def) {
    var name = getName(def.variable);
    var value = args[name];

    if (value === undefined) {
      if (def.defaultValue !== undefined) {
        value = graphql.valueFromASTUntyped(def.defaultValue, args);
      } else {
        return vars;
      }
    }

    vars[name] = value;
    return vars;
  }, makeDict());
};

var SchemaPredicates = function SchemaPredicates(schema) {
  this.schema = graphql.buildClientSchema(schema);
};

SchemaPredicates.prototype.isFieldNullable = function isFieldNullable(typename, fieldName) {
  var field = getField(this.schema, typename, fieldName);

  if (field === undefined) {
    return false;
  }

  return graphql.isNullableType(field.type);
};

SchemaPredicates.prototype.isListNullable = function isListNullable(typename, fieldName) {
  var field = getField(this.schema, typename, fieldName);

  if (field === undefined) {
    return false;
  }

  var ofType = graphql.isNonNullType(field.type) ? field.type.ofType : field.type;
  return graphql.isListType(ofType) && graphql.isNullableType(ofType.ofType);
};

SchemaPredicates.prototype.isFieldAvailableOnType = function isFieldAvailableOnType(typename, fieldname) {
  return !!getField(this.schema, typename, fieldname);
};

SchemaPredicates.prototype.isInterfaceOfType = function isInterfaceOfType(typeCondition, typename) {
  if (!typename || !typeCondition) {
    return false;
  }

  if (typename === typeCondition) {
    return true;
  }

  var abstractType = this.schema.getType(typeCondition);
  var objectType = this.schema.getType(typename);

  if (abstractType instanceof graphql.GraphQLObjectType) {
    return abstractType === objectType;
  }

  expectAbstractType(abstractType, typeCondition);
  expectObjectType(objectType, typename);
  return this.schema.isPossibleType(abstractType, objectType);
};

var getField = function (schema, typename, fieldName) {
  var object = schema.getType(typename);
  expectObjectType(object, typename);
  var field = object.getFields()[fieldName];

  if (field === undefined) {
    process.env.NODE_ENV !== 'production' ? warn('Invalid field: The field `' + fieldName + '` does not exist on `' + typename + '`, ' + 'but the GraphQL document expects it to exist.\n' + 'Traversal will continue, however this may lead to undefined behavior!', 4) : void 0;
    return undefined;
  }

  return field;
};

function expectObjectType(x, typename) {
  invariant(x instanceof graphql.GraphQLObjectType, process.env.NODE_ENV !== "production" ? 'Invalid Object type: The type `' + typename + '` is not an object in the defined schema, ' + 'but the GraphQL document is traversing it.' : "", 3);
}

function expectAbstractType(x, typename) {
  invariant(x instanceof graphql.GraphQLInterfaceType || x instanceof graphql.GraphQLUnionType, process.env.NODE_ENV !== "production" ? 'Invalid Abstract type: The type `' + typename + '` is not an Interface or Union type in the defined schema, ' + 'but a fragment in the GraphQL document is using it as a type condition.' : "", 5);
}

var isFragmentNode = function (node) {
  return node.kind === graphql.Kind.FRAGMENT_DEFINITION;
};
/** Returns the main operation's definition */


function _ref(node) {
  return node.kind === graphql.Kind.OPERATION_DEFINITION;
}

var getMainOperation = function (doc) {
  var operation = doc.definitions.find(_ref);
  invariant(!!operation, process.env.NODE_ENV !== "production" ? 'Invalid GraphQL document: All GraphQL documents must contain an OperationDefinition' + 'node for a query, subscription, or mutation.' : "", 1);
  return operation;
};
/** Returns a mapping from fragment names to their selections */

function _ref2(map, node) {
  map[getName(node)] = node;
  return map;
}

var getFragments = function (doc) {
  return doc.definitions.filter(isFragmentNode).reduce(_ref2, {});
};
var shouldInclude = function (node, vars) {
  var directives = node.directives;

  if (directives === undefined) {
    return true;
  } // Finds any @include or @skip directive that forces the node to be skipped


  for (var i = 0, l = directives.length; i < l; i++) {
    var directive = directives[i];
    var name = getName(directive); // Ignore other directives

    var isInclude = name === 'include';

    if (!isInclude && name !== 'skip') {
      continue;
    } // Get the first argument and expect it to be named "if"


    var arg = directive.arguments ? directive.arguments[0] : null;

    if (!arg || getName(arg) !== 'if') {
      continue;
    }

    var value = graphql.valueFromASTUntyped(arg.value, vars);

    if (typeof value !== 'boolean' && value !== null) {
      continue;
    } // Return whether this directive forces us to skip
    // `@include(if: false)` or `@skip(if: true)`


    return isInclude ? !!value : !value;
  }

  return true;
};

var query = function (store, request, data) {
  initDataState(store.data, 0);
  var result = read(store, request, data); // clearDataState();

  return result;
};
var read = function (store, request, input) {
  var operation = getMainOperation(request.query);
  var rootKey = store.getRootKey(operation.operation);
  var rootSelect = getSelectionSet(operation);
  var ctx = {
    parentTypeName: rootKey,
    parentKey: rootKey,
    parentFieldKey: '',
    fieldName: '',
    variables: normalizeVariables(operation, request.variables),
    fragments: getFragments(request.query),
    partial: false,
    store: store,
    schemaPredicates: store.schemaPredicates
  };

  if (process.env.NODE_ENV !== 'production') {
    pushDebugNode(rootKey, operation);
  }

  var data = input || makeDict();
  data = rootKey !== ctx.store.getRootKey('query') ? readRoot(ctx, rootKey, rootSelect, data) : readSelection(ctx, rootKey, rootSelect, data);
  return {
    dependencies: getCurrentDependencies(),
    partial: data === undefined ? false : ctx.partial,
    data: data === undefined ? null : data
  };
};

var readRoot = function (ctx, entityKey, select, originalData) {
  if (typeof originalData.__typename !== 'string') {
    return originalData;
  }

  var iter = new SelectionIterator(entityKey, entityKey, select, ctx);
  var data = makeDict();
  data.__typename = originalData.__typename;
  var node;

  while ((node = iter.next()) !== undefined) {
    var fieldAlias = getFieldAlias(node);
    var fieldValue = originalData[fieldAlias];

    if (node.selectionSet !== undefined && fieldValue !== null) {
      var fieldData = ensureData(fieldValue);
      data[fieldAlias] = readRootField(ctx, getSelectionSet(node), fieldData);
    } else {
      data[fieldAlias] = fieldValue;
    }
  }

  return data;
};

var readRootField = function (ctx, select, originalData) {
  if (Array.isArray(originalData)) {
    var newData = new Array(originalData.length);

    for (var i = 0, l = originalData.length; i < l; i++) {
      newData[i] = readRootField(ctx, select, originalData[i]);
    }

    return newData;
  } else if (originalData === null) {
    return null;
  } // Write entity to key that falls back to the given parentFieldKey


  var entityKey = ctx.store.keyOfEntity(originalData);

  if (entityKey !== null) {
    // We assume that since this is used for result data this can never be undefined,
    // since the result data has already been written to the cache
    var fieldValue = readSelection(ctx, entityKey, select, makeDict());
    return fieldValue === undefined ? null : fieldValue;
  } else {
    return readRoot(ctx, originalData.__typename, select, originalData);
  }
};

var readFragment = function (store, query, entity, variables) {
  var fragments = getFragments(query);
  var names = Object.keys(fragments);
  var fragment = fragments[names[0]];

  if (fragment === undefined) {
    process.env.NODE_ENV !== 'production' ? warn('readFragment(...) was called with an empty fragment.\n' + 'You have to call it with at least one fragment in your GraphQL document.', 6) : void 0;
    return null;
  }

  var typename = getFragmentTypeName(fragment);

  if (typeof entity !== 'string' && !entity.__typename) {
    entity.__typename = typename;
  }

  var entityKey = typeof entity !== 'string' ? store.keyOfEntity(_extends({
    __typename: typename
  }, entity)) : entity;

  if (!entityKey) {
    process.env.NODE_ENV !== 'production' ? warn("Can't generate a key for readFragment(...).\n" + 'You have to pass an `id` or `_id` field or create a custom `keys` config for `' + typename + '`.', 7) : void 0;
    return null;
  }

  if (process.env.NODE_ENV !== 'production') {
    pushDebugNode(typename, fragment);
  }

  var ctx = {
    parentTypeName: typename,
    parentKey: entityKey,
    parentFieldKey: '',
    fieldName: '',
    variables: variables || {},
    fragments: fragments,
    partial: false,
    store: store,
    schemaPredicates: store.schemaPredicates
  };
  return readSelection(ctx, entityKey, getSelectionSet(fragment), makeDict()) || null;
};
var readSelection = mobx.action(function (ctx, entityKey, select, data) {
  var store = ctx.store;
  var schemaPredicates = ctx.schemaPredicates;
  var isQuery = entityKey === store.getRootKey('query'); // Get the __typename field for a given entity to check that it exists

  var typename = !isQuery ? readRecord(entityKey, '__typename') : entityKey;

  if (typeof typename !== 'string') {
    return undefined;
  }

  data.__typename = typename;
  var iter = new SelectionIterator(typename, entityKey, select, ctx);
  var node;
  var hasFields = false;
  var hasPartials = false;

  var loop = function () {
    // Derive the needed data from our node.
    var fieldName = getName(node);
    var fieldArgs = getFieldArguments(node, ctx.variables);
    var fieldAlias = getFieldAlias(node);
    var fieldKey = keyOfField(fieldName, fieldArgs);
    var fieldValue = readRecord(entityKey, fieldKey);
    var fieldParent = readParent(entityKey, fieldKey);
    var key = joinKeys(entityKey, fieldKey);
    var pleaseDontAssign = false;

    if (process.env.NODE_ENV !== 'production' && schemaPredicates && typename) {
      schemaPredicates.isFieldAvailableOnType(typename, fieldName);
    } // We temporarily store the data field in here, but undefined
    // means that the value is missing from the cache


    var dataFieldValue = void 0;
    var resolvers = store.resolvers[typename];

    function _ref() {
      return fieldParent !== null && fieldParent !== undefined ? fieldParent[fieldAlias] : undefined;
    }

    function _ref2() {
      var localLink = readLink(entityKey, fieldKey);

      if (!localLink) {
        return undefined;
      }

      var linkedEntity = resolveLink(ctx, localLink, localTypeName, fieldName, getSelectionSet(localNode), undefined);
      return linkedEntity !== null && linkedEntity !== undefined ? linkedEntity : undefined;
    }

    if (resolvers !== undefined && typeof resolvers[fieldName] === 'function') {
      // We have to update the information in context to reflect the info
      // that the resolver will receive
      ctx.parentTypeName = typename;
      ctx.parentKey = entityKey;
      ctx.parentFieldKey = key;
      ctx.fieldName = fieldName; // We have a resolver for this field.
      // Prepare the actual fieldValue, so that the resolver can use it

      if (fieldValue !== undefined) {
        data[fieldAlias] = fieldValue;
      }

      dataFieldValue = resolvers[fieldName](data, fieldArgs || makeDict(), store, ctx);

      if (node.selectionSet !== undefined) {
        // When it has a selection set we are resolving an entity with a
        // subselection. This can either be a list or an object.
        dataFieldValue = resolveResolverResult(ctx, typename, fieldName, key, getSelectionSet(node), data[fieldAlias] || makeDict(), dataFieldValue);
      }

      if (schemaPredicates !== undefined && dataFieldValue === null && !schemaPredicates.isFieldNullable(typename, fieldName)) {
        // Special case for when null is not a valid value for the
        // current field
        return {
          v: undefined
        };
      }
    } else if (node.selectionSet === undefined) {
      // The field is a scalar and can be retrieved directly
      dataFieldValue = fieldValue;
      pleaseDontAssign = true;

      if (data[fieldAlias] === undefined) {
        Object.defineProperty(data, fieldAlias, {
          get: _ref
        });
      }
    } else {
      // We have a selection set which means that we'll be checking for links
      var link = readLink(entityKey, fieldKey);

      if (link !== undefined) {
        dataFieldValue = resolveLink(ctx, link, typename, fieldName, getSelectionSet(node), data[fieldAlias]);

        if (data[fieldAlias] === undefined) {
          pleaseDontAssign = true;
          var localNode = node;
          var localTypeName = typename;
          Object.defineProperty(data, fieldAlias, {
            get: _ref2
          });
        }
      } else if (typeof fieldValue === 'object' && fieldValue !== null) {
        // The entity on the field was invalid but can still be recovered
        dataFieldValue = fieldValue;
      }
    } // Now that dataFieldValue has been retrieved it'll be set on data
    // If it's uncached (undefined) but nullable we can continue assembling
    // a partial query result


    if (dataFieldValue === undefined && schemaPredicates !== undefined && schemaPredicates.isFieldNullable(typename, fieldName)) {
      // The field is uncached but we have a schema that says it's nullable
      // Set the field to null and continue
      hasPartials = true;
      data[fieldAlias] = null;
    } else if (dataFieldValue === undefined) {
      // The field is uncached and not nullable; return undefined
      return {
        v: undefined
      };
    } else {
      // Otherwise continue as usual
      hasFields = true;

      if (pleaseDontAssign === false) {
        data[fieldAlias] = dataFieldValue;
      }
    }
  };

  while ((node = iter.next()) !== undefined) {
    var returned = loop();
    if (returned) return returned.v;
  }

  if (hasPartials) {
    ctx.partial = true;
  }

  return isQuery && hasPartials && !hasFields ? undefined : data;
});

var readResolverResult = function (ctx, key, select, data, result) {
  var store = ctx.store;
  var schemaPredicates = ctx.schemaPredicates;
  var entityKey = store.keyOfEntity(result) || key;
  var resolvedTypename = result.__typename;
  var typename = readRecord(entityKey, '__typename') || resolvedTypename;

  if (typeof typename !== 'string' || resolvedTypename && typename !== resolvedTypename) {
    // TODO: This may be an invalid error for resolvers that return interfaces
    process.env.NODE_ENV !== 'production' ? warn('Invalid resolver data: The resolver at `' + entityKey + '` returned an ' + 'invalid typename that could not be reconciled with the cache.', 8) : void 0;
    return undefined;
  } // The following closely mirrors readSelection, but differs only slightly for the
  // sake of resolving from an existing resolver result


  data.__typename = typename;
  var iter = new SelectionIterator(typename, entityKey, select, ctx);
  var node;
  var hasFields = false;
  var hasPartials = false;

  while ((node = iter.next()) !== undefined) {
    // Derive the needed data from our node.
    var fieldName = getName(node);
    var fieldAlias = getFieldAlias(node);
    var fieldKey = keyOfField(fieldName, getFieldArguments(node, ctx.variables));
    var key$1 = joinKeys(entityKey, fieldKey);
    var fieldValue = readRecord(entityKey, fieldKey);
    var resultValue = result[fieldName];

    if (process.env.NODE_ENV !== 'production' && schemaPredicates && typename) {
      schemaPredicates.isFieldAvailableOnType(typename, fieldName);
    } // We temporarily store the data field in here, but undefined
    // means that the value is missing from the cache


    var dataFieldValue = void 0;

    if (resultValue !== undefined && node.selectionSet === undefined) {
      // The field is a scalar and can be retrieved directly from the result
      dataFieldValue = resultValue;
    } else if (node.selectionSet === undefined) {
      // The field is a scalar but isn't on the result, so it's retrieved from the cache
      dataFieldValue = fieldValue;
    } else if (resultValue !== undefined) {
      // We start walking the nested resolver result here
      dataFieldValue = resolveResolverResult(ctx, typename, fieldName, key$1, getSelectionSet(node), data[fieldAlias], resultValue);
    } else {
      // Otherwise we attempt to get the missing field from the cache
      var link = readLink(entityKey, fieldKey);

      if (link !== undefined) {
        dataFieldValue = resolveLink(ctx, link, typename, fieldName, getSelectionSet(node), data[fieldAlias]);
      } else if (typeof fieldValue === 'object' && fieldValue !== null) {
        // The entity on the field was invalid but can still be recovered
        dataFieldValue = fieldValue;
      }
    } // Now that dataFieldValue has been retrieved it'll be set on data
    // If it's uncached (undefined) but nullable we can continue assembling
    // a partial query result


    if (dataFieldValue === undefined && schemaPredicates !== undefined && schemaPredicates.isFieldNullable(typename, fieldName)) {
      // The field is uncached but we have a schema that says it's nullable
      // Set the field to null and continue
      hasPartials = true;
      data[fieldAlias] = null;
    } else if (dataFieldValue === undefined) {
      // The field is uncached and not nullable; return undefined
      return undefined;
    } else {
      // Otherwise continue as usual
      hasFields = true;
      data[fieldAlias] = dataFieldValue;
    }
  }

  if (hasPartials) {
    ctx.partial = true;
  }

  return !hasFields ? undefined : data;
};

var resolveResolverResult = function (ctx, typename, fieldName, key, select, prevData, result) {
  if (Array.isArray(result)) {
    var schemaPredicates = ctx.schemaPredicates; // Check whether values of the list may be null; for resolvers we assume
    // that they can be, since it's user-provided data

    var isListNullable = schemaPredicates === undefined || schemaPredicates.isListNullable(typename, fieldName);
    var data = new Array(result.length);

    for (var i = 0, l = result.length; i < l; i++) {
      // Recursively read resolver result
      var childResult = resolveResolverResult(ctx, typename, fieldName, joinKeys(key, "" + i), select, // Get the inner previous data from prevData
      prevData !== undefined ? prevData[i] : undefined, result[i]);

      if (childResult === undefined && !isListNullable) {
        return undefined;
      } else {
        data[i] = childResult !== undefined ? childResult : null;
      }
    }

    return data;
  } else if (result === null || result === undefined) {
    return result;
  } else if (isDataOrKey(result)) {
    var data$1 = prevData === undefined ? makeDict() : prevData;
    return typeof result === 'string' ? readSelection(ctx, result, select, data$1) : readResolverResult(ctx, key, select, data$1, result);
  } else {
    process.env.NODE_ENV !== 'production' ? warn('Invalid resolver value: The field at `' + key + '` is a scalar (number, boolean, etc)' + ', but the GraphQL query expects a selection set for this field.', 9) : void 0;
    return undefined;
  }
};

var resolveLink = function (ctx, link, typename, fieldName, select, prevData) {
  if (Array.isArray(link)) {
    var schemaPredicates = ctx.schemaPredicates;
    var isListNullable = schemaPredicates !== undefined && schemaPredicates.isListNullable(typename, fieldName);
    var newLink = new Array(link.length);

    for (var i = 0, l = link.length; i < l; i++) {
      var childLink = resolveLink(ctx, link[i], typename, fieldName, select, prevData !== undefined ? prevData[i] : undefined);

      if (childLink === undefined && !isListNullable) {
        return undefined;
      } else {
        newLink[i] = childLink !== undefined ? childLink : null;
      }
    }

    return newLink;
  } else if (link === null) {
    return null;
  } else {
    // console.log({link, prevData})
    return readSelection(ctx, link, select, prevData === undefined ? makeDict() : prevData);
  }
};

var isDataOrKey = function (x) {
  return typeof x === 'string' || typeof x === 'object' && typeof x.__typename === 'string';
};

var addCacheOutcome = function (op, outcome) {
  return _extends(_extends({}, op), {
    context: _extends(_extends({}, op.context), {
      meta: _extends(_extends({}, op.context.meta), {
        cacheOutcome: outcome
      })
    })
  });
}; // Returns the given operation with added __typename fields on its query


var addTypeNames = function (op) {
  return _extends(_extends({}, op), {
    query: core.formatDocument(op.query)
  });
}; // Retrieves the requestPolicy from an operation


var getRequestPolicy = function (op) {
  return op.context.requestPolicy;
}; // Returns whether an operation is a query


var isQueryOperation = function (op) {
  return op.operationName === 'query';
}; // Returns whether an operation is a mutation


var isMutationOperation = function (op) {
  return op.operationName === 'mutation';
}; // Returns whether an operation can potentially be read from cache


var isCacheableQuery = function (op) {
  return isQueryOperation(op) && getRequestPolicy(op) !== 'network-only';
}; // Returns whether an operation potentially triggers an optimistic update


var isOptimisticMutation = function (op) {
  return isMutationOperation(op) && getRequestPolicy(op) !== 'network-only';
}; // Copy an operation and change the requestPolicy to skip the cache


var toRequestPolicy = function (operation, requestPolicy) {
  return _extends(_extends({}, operation), {
    context: _extends(_extends({}, operation.context), {
      requestPolicy: requestPolicy
    })
  });
};

function _ref3(op) {
  return isCacheableQuery(op);
}

function _ref4(res) {
  return addCacheOutcome(res.operation, res.outcome);
}

function _ref5(res) {
  return res.outcome === 'miss';
}

function _ref7(res) {
  return res.outcome !== 'miss';
}

function _ref8(op) {
  return !isCacheableQuery(op);
}

var cacheExchange = function (opts) {
  return function (ref) {
    var forward = ref.forward;
    var client = ref.client;

    if (!opts) {
      opts = {};
    }

    var store = new Store(opts.schema ? new SchemaPredicates(opts.schema) : undefined, opts.resolvers, opts.updates, opts.optimistic, opts.keys);
    var hydration;

    function _ref(entries) {
      hydrateData(store.data, storage, entries);
    }

    if (opts.storage) {
      var storage = opts.storage;
      hydration = storage.read().then(_ref);
    }

    var optimisticKeysToDependencies = new Map();
    var ops = new Map();
    var deps = makeDict();

    var collectPendingOperations = function (pendingOperations, dependencies) {
      function _ref2(dep) {
        var keys = deps[dep];

        if (keys !== undefined) {
          deps[dep] = [];

          for (var i = 0, l = keys.length; i < l; i++) {
            pendingOperations.add(keys[i]);
          }
        }
      }

      if (dependencies !== undefined) {
        // Collect operations that will be updated due to cache changes
        dependencies.forEach(_ref2);
      }
    };

    var executePendingOperations = function (operation, pendingOperations) {
      // Reexecute collected operations and delete them from the mapping
      pendingOperations.forEach(function (key) {
        if (key !== operation.key) {
          var op = ops.get(key);

          if (op !== undefined) {
            ops.delete(key);
            client.reexecuteOperation(toRequestPolicy(op, 'cache-first'));
          }
        }
      });
    }; // This executes an optimistic update for mutations and registers it if necessary


    var optimisticUpdate = function (operation) {
      if (isOptimisticMutation(operation)) {
        var key = operation.key;
        var ref = writeOptimistic(store, operation, key);
        var dependencies = ref.dependencies;

        if (dependencies.size !== 0) {
          optimisticKeysToDependencies.set(key, dependencies);
          var pendingOperations = new Set();
          collectPendingOperations(pendingOperations, dependencies);
          executePendingOperations(operation, pendingOperations);
        }
      }
    }; // This updates the known dependencies for the passed operation


    var updateDependencies = function (op, dependencies) {
      dependencies.forEach(function (dep) {
        var keys = deps[dep] || (deps[dep] = []);
        keys.push(op.key);

        if (!ops.has(op.key)) {
          ops.set(op.key, getRequestPolicy(op) === 'network-only' ? toRequestPolicy(op, 'cache-and-network') : op);
        }
      });
    }; // Retrieves a query result from cache and adds an `isComplete` hint
    // This hint indicates whether the result is "complete" or not


    var operationResultFromCache = function (operation) {
      var ref = query(store, operation);
      var data = ref.data;
      var dependencies = ref.dependencies;
      var partial = ref.partial;
      var cacheOutcome;

      if (data === null) {
        cacheOutcome = 'miss';
      } else {
        updateDependencies(operation, dependencies);
        cacheOutcome = !partial || getRequestPolicy(operation) === 'cache-only' ? 'hit' : 'partial';
      }

      return {
        outcome: cacheOutcome,
        operation: operation,
        data: data
      };
    }; // Take any OperationResult and update the cache with it


    var updateCacheWithResult = function (result) {
      var operation = result.operation;
      var error = result.error;
      var extensions = result.extensions;
      var isQuery = isQueryOperation(operation);
      var data = result.data; // Clear old optimistic values from the store

      var key = operation.key;
      var pendingOperations = new Set();
      collectPendingOperations(pendingOperations, optimisticKeysToDependencies.get(key));
      optimisticKeysToDependencies.delete(key);
      clearOptimistic(store.data, key);
      var writeDependencies;
      var queryDependencies;

      if (data !== null && data !== undefined) {
        writeDependencies = write(store, operation, data).dependencies;

        if (isQuery) {
          var queryResult = query(store, operation);
          data = queryResult.data;
          queryDependencies = queryResult.dependencies;
        } else {
          data = query(store, operation, data).data;
        }
      } // Collect all write dependencies and query dependencies for queries


      collectPendingOperations(pendingOperations, writeDependencies);

      if (isQuery) {
        collectPendingOperations(pendingOperations, queryDependencies);
      } // Execute all pending operations related to changed dependencies


      executePendingOperations(result.operation, pendingOperations); // Update this operation's dependencies if it's a query

      if (isQuery && queryDependencies !== undefined) {
        updateDependencies(result.operation, queryDependencies);
      }

      return {
        data: data,
        error: error,
        extensions: extensions,
        operation: operation
      };
    };

    function _ref6(res) {
      var operation = res.operation;
      var outcome = res.outcome;
      var policy = getRequestPolicy(operation);
      var result = {
        operation: addCacheOutcome(operation, outcome),
        data: res.data,
        error: res.error,
        extensions: res.extensions
      };

      if (policy === 'cache-and-network' || policy === 'cache-first' && outcome === 'partial') {
        result.stale = true;
        client.reexecuteOperation(toRequestPolicy(operation, 'network-only'));
      }

      return result;
    }

    return function (ops$) {
      var sharedOps$ = wonka.share(ops$); // Buffer operations while waiting on hydration to finish
      // If no hydration takes place we replace this stream with an empty one

      var bufferedOps$ = hydration ? wonka.mergeMap(wonka.fromArray)(wonka.take(1)(wonka.buffer(wonka.fromPromise(hydration))(sharedOps$))) : wonka.empty;
      var inputOps$ = wonka.share(wonka.tap(optimisticUpdate)(wonka.map(addTypeNames)(wonka.concat([bufferedOps$, sharedOps$])))); // Filter by operations that are cacheable and attempt to query them from the cache

      var cache$ = wonka.share(wonka.map(operationResultFromCache)(wonka.filter(_ref3)(inputOps$))); // Rebound operations that are incomplete, i.e. couldn't be queried just from the cache

      var cacheOps$ = wonka.map(_ref4)(wonka.filter(_ref5)(cache$)); // Resolve OperationResults that the cache was able to assemble completely and trigger
      // a network request if the current operation's policy is cache-and-network

      var cacheResult$ = wonka.map(_ref6)(wonka.filter(_ref7)(cache$)); // Forward operations that aren't cacheable and rebound operations
      // Also update the cache with any network results

      var result$ = wonka.map(updateCacheWithResult)(forward(wonka.merge([wonka.filter(_ref8)(inputOps$), cacheOps$])));
      return wonka.merge([result$, cacheResult$]);
    };
  };
};

/** An exchange for auto-populating mutations with a required response body. */

var populateExchange = function (ref) {
  var ogSchema = ref.schema;
  return function (ref) {
    var forward = ref.forward;
    var schema = graphql.buildClientSchema(ogSchema);
    /** List of operation keys that have already been parsed. */

    var parsedOperations = new Set();
    /** List of operation keys that have not been torn down. */

    var activeOperations = new Set();
    /** Collection of fragments used by the user. */

    var userFragments = makeDict();
    /** Collection of actively in use type fragments. */

    var activeTypeFragments = makeDict();
    /** Handle mutation and inject selections + fragments. */

    function _ref(s) {
      return activeOperations.has(s.key);
    }

    var handleIncomingMutation = function (op) {
      if (op.operationName !== 'mutation') {
        return op;
      }

      var activeSelections = makeDict();

      for (var name in activeTypeFragments) {
        activeSelections[name] = activeTypeFragments[name].filter(_ref);
      }

      return _extends(_extends({}, op), {
        query: addFragmentsToQuery(schema, op.query, activeSelections, userFragments)
      });
    };
    /** Handle query and extract fragments. */


    var handleIncomingQuery = function (ref) {
      var key = ref.key;
      var operationName = ref.operationName;
      var query = ref.query;

      if (operationName !== 'query') {
        return;
      }

      activeOperations.add(key);

      if (parsedOperations.has(key)) {
        return;
      }

      parsedOperations.add(key);
      var ref$1 = extractSelectionsFromQuery(schema, query);
      var extractedFragments = ref$1[0];
      var newFragments = ref$1[1];

      for (var i = 0, l = extractedFragments.length; i < l; i++) {
        var fragment = extractedFragments[i];
        userFragments[getName(fragment)] = fragment;
      }

      for (var i$1 = 0, l$1 = newFragments.length; i$1 < l$1; i$1++) {
        var fragment$1 = newFragments[i$1];
        var type = getName(fragment$1.typeCondition);
        var current = activeTypeFragments[type] || (activeTypeFragments[type] = []);
        fragment$1.name.value += current.length;
        current.push({
          key: key,
          fragment: fragment$1
        });
      }
    };

    var handleIncomingTeardown = function (ref) {
      var key = ref.key;
      var operationName = ref.operationName;

      if (operationName === 'teardown') {
        activeOperations.delete(key);
      }
    };

    return function (ops$) {
      return forward(wonka.map(handleIncomingMutation)(wonka.tap(handleIncomingTeardown)(wonka.tap(handleIncomingQuery)(ops$))));
    };
  };
};
/** Gets typed selection sets and fragments from query */

var extractSelectionsFromQuery = function (schema, query) {
  var extractedFragments = [];
  var newFragments = [];
  var typeInfo = new graphql.TypeInfo(schema);
  graphql.visit(query, graphql.visitWithTypeInfo(typeInfo, {
    Field: function (node) {
      if (node.selectionSet) {
        var type = getTypeName(typeInfo);
        newFragments.push({
          kind: graphql.Kind.FRAGMENT_DEFINITION,
          typeCondition: {
            kind: graphql.Kind.NAMED_TYPE,
            name: nameNode(type)
          },
          name: nameNode(type + "_PopulateFragment_"),
          selectionSet: node.selectionSet
        });
      }
    },
    FragmentDefinition: function (node) {
      extractedFragments.push(node);
    }
  }));
  return [extractedFragments, newFragments];
};
/** Replaces populate decorator with fragment spreads + fragments. */

function _ref2$1(d) {
  return getName(d) !== 'populate';
}

function _ref4$1(set, definition) {
  if (definition.kind === 'FragmentDefinition') {
    set.add(definition.name.value);
  }

  return set;
}

var addFragmentsToQuery = function (schema, query, activeTypeFragments, userFragments) {
  var typeInfo = new graphql.TypeInfo(schema);
  var requiredUserFragments = makeDict();
  var additionalFragments = makeDict();
  /** Fragments provided and used by the current query */

  var existingFragmentsForQuery = new Set();

  function _ref3(p, possibleType) {
    var typeFrags = activeTypeFragments[possibleType.name];

    if (!typeFrags) {
      return p;
    }

    for (var i = 0, l = typeFrags.length; i < l; i++) {
      var ref = typeFrags[i];
      var fragment = ref.fragment;
      var fragmentName = getName(fragment);
      var usedFragments = getUsedFragments(fragment); // Add used fragment for insertion at Document node

      for (var j = 0, l$1 = usedFragments.length; j < l$1; j++) {
        var name = usedFragments[j];

        if (!existingFragmentsForQuery.has(name)) {
          requiredUserFragments[name] = userFragments[name];
        }
      } // Add fragment for insertion at Document node


      additionalFragments[fragmentName] = fragment;
      p.push({
        kind: graphql.Kind.FRAGMENT_SPREAD,
        name: nameNode(fragmentName)
      });
    }

    return p;
  }

  return graphql.visit(query, graphql.visitWithTypeInfo(typeInfo, {
    Field: {
      enter: function (node) {
        if (!node.directives) {
          return;
        }

        var directives = node.directives.filter(_ref2$1);

        if (directives.length === node.directives.length) {
          return;
        }

        var possibleTypes = getTypes(schema, typeInfo);
        var newSelections = possibleTypes.reduce(_ref3, []);
        var existingSelections = getSelectionSet(node);
        var selections = existingSelections.length + newSelections.length !== 0 ? newSelections.concat(existingSelections) : [{
          kind: graphql.Kind.FIELD,
          name: nameNode('__typename')
        }];
        return _extends(_extends({}, node), {
          directives: directives,
          selectionSet: {
            kind: graphql.Kind.SELECTION_SET,
            selections: selections
          }
        });
      }
    },
    Document: {
      enter: function (node) {
        node.definitions.reduce(_ref4$1, existingFragmentsForQuery);
      },
      leave: function (node) {
        var definitions = [].concat(node.definitions);

        for (var key in additionalFragments) {
          definitions.push(additionalFragments[key]);
        }

        for (var key$1 in requiredUserFragments) {
          definitions.push(requiredUserFragments[key$1]);
        }

        return _extends(_extends({}, node), {
          definitions: definitions
        });
      }
    }
  }));
};

var nameNode = function (value) {
  return {
    kind: graphql.Kind.NAME,
    value: value
  };
};
/** Get all possible types for node with TypeInfo. */


var getTypes = function (schema, typeInfo) {
  var type = unwrapType(typeInfo.getType());

  if (!graphql.isCompositeType(type)) {
    process.env.NODE_ENV !== 'production' ? warn('Invalid type: The type ` + type + ` is used with @populate but does not exist.', 17) : void 0;
    return [];
  }

  return graphql.isAbstractType(type) ? schema.getPossibleTypes(type) : [type];
};
/** Get name of non-abstract type for adding to 'activeTypeFragments'. */


var getTypeName = function (typeInfo) {
  var type = unwrapType(typeInfo.getType());
  invariant(type && !graphql.isAbstractType(type), process.env.NODE_ENV !== "production" ? 'Invalid TypeInfo state: Found no flat schema type when one was expected.' : "", 18);
  return type.toString();
};
/** Get fragment names referenced by node. */


var getUsedFragments = function (node) {
  var names = [];
  graphql.visit(node, {
    FragmentSpread: function (f) {
      names.push(getName(f));
    }
  });
  return names;
};

exports.Store = Store;
exports.cacheExchange = cacheExchange;
exports.clearDataState = clearDataState;
exports.initDataState = initDataState;
exports.populateExchange = populateExchange;
exports.query = query;
exports.read = read;
exports.write = write;
exports.writeFragment = writeFragment;
exports.writeOptimistic = writeOptimistic;
//# sourceMappingURL=urql-exchange-graphcache.js.map