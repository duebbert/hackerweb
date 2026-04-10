// Lightweight storage wrapper with TTL support

const rprefix = /^__hw__/

function createStorage(storage) {
	return function (key, value, options) {
		const now = Date.now()

		if (!key) {
			const ret = {}
			try {
				for (let i = 0, l = storage.length; i < l; i++) {
					const k = storage.key(i)
					if (rprefix.test(k)) {
						const parsed = JSON.parse(storage.getItem(k))
						if (parsed.expires && parsed.expires <= now) {
							storage.removeItem(k)
						} else {
							ret[k.replace(rprefix, '')] = parsed.data
						}
					}
				}
			} catch (_e) {
				/* localStorage may be unavailable */
			}
			return ret
		}

		const prefixedKey = '__hw__' + key

		if (value === undefined) {
			const stored = storage.getItem(prefixedKey)
			if (!stored) return undefined
			const entry = JSON.parse(stored)
			if (entry.expires && entry.expires <= now) {
				storage.removeItem(prefixedKey)
				return undefined
			}
			return entry.data
		}

		if (value === null) {
			storage.removeItem(prefixedKey)
			return null
		}

		options = options || {}
		const data = JSON.stringify({
			data: value,
			expires: options.expires ? now + options.expires : null,
		})
		try {
			storage.setItem(prefixedKey, data)
		} catch (_e) {
			// Quota exceeded — clear expired items and retry
			createStorage(storage)()
			try {
				storage.setItem(prefixedKey, data)
			} catch (_e) {
				throw 'store quota exceeded'
			}
		}
		return value
	}
}

// In-memory fallback
const memory = {}
const timeouts = {}
function memoryStorage(key, value, options) {
	if (!key) return JSON.parse(JSON.stringify(memory))
	if (value === undefined)
		return memory[key] === undefined
			? undefined
			: JSON.parse(JSON.stringify(memory[key]))
	if (timeouts[key]) {
		clearTimeout(timeouts[key])
		delete timeouts[key]
	}
	if (value === null) {
		delete memory[key]
		return null
	}
	memory[key] = value
	options = options || {}
	if (options.expires) {
		timeouts[key] = setTimeout(function () {
			delete memory[key]
			delete timeouts[key]
		}, options.expires)
	}
	return value
}

// Main store — defaults to localStorage
const store = function (key, value, options) {
	return store.localStorage(key, value, options)
}

// Try localStorage
try {
	window.localStorage.setItem('__hw__', 'x')
	window.localStorage.removeItem('__hw__')
	store.localStorage = createStorage(window.localStorage)
} catch (_e) {
	store.localStorage = memoryStorage
}

// Try sessionStorage
try {
	window.sessionStorage.setItem('__hw__', 'x')
	window.sessionStorage.removeItem('__hw__')
	store.sessionStorage = createStorage(window.sessionStorage)
} catch (_e) {
	store.sessionStorage = memoryStorage
}

store.memory = memoryStorage

export default store
