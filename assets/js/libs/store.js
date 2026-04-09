// Lightweight storage wrapper replacing amplify.store
// Keeps __amplify__ prefix for backward compat with existing user data

var rprefix = /^__amplify__/;

function createStorage(storage) {
	return function (key, value, options) {
		var now = Date.now();

		if (!key) {
			var ret = {};
			try {
				for (var i = 0, l = storage.length; i < l; i++) {
					var k = storage.key(i);
					if (rprefix.test(k)) {
						var parsed = JSON.parse(storage.getItem(k));
						if (parsed.expires && parsed.expires <= now) {
							storage.removeItem(k);
						} else {
							ret[k.replace(rprefix, '')] = parsed.data;
						}
					}
				}
			} catch (e) {}
			return ret;
		}

		var prefixedKey = '__amplify__' + key;

		if (value === undefined) {
			var stored = storage.getItem(prefixedKey);
			if (!stored) return undefined;
			var parsed = JSON.parse(stored);
			if (parsed.expires && parsed.expires <= now) {
				storage.removeItem(prefixedKey);
				return undefined;
			}
			return parsed.data;
		}

		if (value === null) {
			storage.removeItem(prefixedKey);
			return null;
		}

		options = options || {};
		var data = JSON.stringify({
			data: value,
			expires: options.expires ? now + options.expires : null,
		});
		try {
			storage.setItem(prefixedKey, data);
		} catch (e) {
			// Quota exceeded — clear expired items and retry
			createStorage(storage)();
			try {
				storage.setItem(prefixedKey, data);
			} catch (e) {
				throw 'amplify.store quota exceeded';
			}
		}
		return value;
	};
}

// In-memory fallback
var memory = {};
var timeouts = {};
function memoryStorage(key, value, options) {
	if (!key) return JSON.parse(JSON.stringify(memory));
	if (value === undefined)
		return memory[key] === undefined ? undefined : JSON.parse(JSON.stringify(memory[key]));
	if (timeouts[key]) {
		clearTimeout(timeouts[key]);
		delete timeouts[key];
	}
	if (value === null) {
		delete memory[key];
		return null;
	}
	memory[key] = value;
	options = options || {};
	if (options.expires) {
		timeouts[key] = setTimeout(function () {
			delete memory[key];
			delete timeouts[key];
		}, options.expires);
	}
	return value;
}

// Main store — defaults to localStorage
var store = function (key, value, options) {
	return store.localStorage(key, value, options);
};

// Try localStorage
try {
	window.localStorage.setItem('__amplify__', 'x');
	window.localStorage.removeItem('__amplify__');
	store.localStorage = createStorage(window.localStorage);
} catch (e) {
	store.localStorage = memoryStorage;
}

// Try sessionStorage
try {
	window.sessionStorage.setItem('__amplify__', 'x');
	window.sessionStorage.removeItem('__amplify__');
	store.sessionStorage = createStorage(window.sessionStorage);
} catch (e) {
	store.sessionStorage = memoryStorage;
}

store.memory = memoryStorage;

export default store;
